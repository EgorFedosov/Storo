using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using backend.Modules.Integrations.UseCases.Salesforce;

namespace backend.Modules.Integrations.Infrastructure.Salesforce;

public sealed class SalesforceRestClient(
    IHttpClientFactory httpClientFactory,
    SalesforceOptions options) : ISalesforceRestClient
{
    private static readonly JsonSerializerOptions JsonSerializerOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient httpClient = httpClientFactory.CreateClient(SalesforceAccessTokenClient.HttpClientName);

    public async Task<SalesforceCreateAccountResult> CreateAccountAsync(
        SalesforceCreateAccountRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        cancellationToken.ThrowIfCancellationRequested();

        var accessToken = NormalizeRequired(request.AccessToken, nameof(request.AccessToken));
        var companyName = NormalizeRequired(request.CompanyName, nameof(request.CompanyName));

        var payload = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["Name"] = companyName
        };

        var sfAccountId = await CreateSObjectAsync(accessToken, "Account", payload, cancellationToken);
        return new SalesforceCreateAccountResult(sfAccountId);
    }

    public async Task<SalesforceCreateContactResult> CreateContactAsync(
        SalesforceCreateContactRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        cancellationToken.ThrowIfCancellationRequested();

        var accessToken = NormalizeRequired(request.AccessToken, nameof(request.AccessToken));
        var accountId = NormalizeRequired(request.AccountId, nameof(request.AccountId));
        var lastName = NormalizeRequired(request.LastName, nameof(request.LastName));

        var payload = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["LastName"] = lastName,
            ["AccountId"] = accountId
        };

        AddOptional(payload, "Email", request.Email);
        AddOptional(payload, "Phone", request.Phone);
        AddOptional(payload, "Title", request.JobTitle);
        AddOptional(payload, "MailingCountry", request.Country);
        AddOptional(payload, "Description", request.Notes);

        var sfContactId = await CreateSObjectAsync(accessToken, "Contact", payload, cancellationToken);
        return new SalesforceCreateContactResult(sfContactId);
    }

    private async Task<string> CreateSObjectAsync(
        string accessToken,
        string sObjectName,
        IReadOnlyDictionary<string, string> payload,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            BuildSObjectEndpoint(options.InstanceUrl, options.ApiVersion, sObjectName));

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Content = new StringContent(
            JsonSerializer.Serialize(payload, JsonSerializerOptions),
            Encoding.UTF8,
            "application/json");

        using var response = await httpClient.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);

        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Salesforce {sObjectName} create request failed with status {(int)response.StatusCode} ({response.ReasonPhrase}). Body: {responseBody}");
        }

        SalesforceCreateSObjectResponseDto? responsePayload;
        try
        {
            responsePayload = JsonSerializer.Deserialize<SalesforceCreateSObjectResponseDto>(responseBody, JsonSerializerOptions);
        }
        catch (JsonException exception)
        {
            throw new InvalidOperationException($"Salesforce {sObjectName} create response has invalid JSON.", exception);
        }

        if (responsePayload?.Success is false)
        {
            throw new InvalidOperationException(BuildFailureMessage(sObjectName, responsePayload.Errors));
        }

        var id = responsePayload?.Id?.Trim();
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new InvalidOperationException($"Salesforce {sObjectName} create response does not contain id.");
        }

        return id;
    }

    private static Uri BuildSObjectEndpoint(string instanceUrl, string apiVersion, string sObjectName)
    {
        return new Uri($"{instanceUrl}/services/data/{apiVersion}/sobjects/{sObjectName}", UriKind.Absolute);
    }

    private static void AddOptional(
        IDictionary<string, string> payload,
        string key,
        string? value)
    {
        var normalized = NormalizeOptional(value);
        if (normalized is not null)
        {
            payload[key] = normalized;
        }
    }

    private static string NormalizeRequired(string? value, string parameterName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Value cannot be null or whitespace.", parameterName);
        }

        return value.Trim();
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }

    private static string BuildFailureMessage(string sObjectName, JsonElement? errors)
    {
        var errorsText = FormatErrors(errors);
        return string.IsNullOrWhiteSpace(errorsText)
            ? $"Salesforce {sObjectName} create response indicates failure."
            : $"Salesforce {sObjectName} create response indicates failure. Errors: {errorsText}";
    }

    private static string? FormatErrors(JsonElement? errors)
    {
        if (!errors.HasValue)
        {
            return null;
        }

        var value = errors.Value;
        if (value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            return null;
        }

        if (value.ValueKind != JsonValueKind.Array)
        {
            return value.GetRawText();
        }

        var messages = new List<string>();
        foreach (var item in value.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.String)
            {
                var message = item.GetString();
                if (!string.IsNullOrWhiteSpace(message))
                {
                    messages.Add(message.Trim());
                }

                continue;
            }

            if (item.ValueKind == JsonValueKind.Object
                && item.TryGetProperty("message", out var messageProperty)
                && messageProperty.ValueKind == JsonValueKind.String)
            {
                var message = messageProperty.GetString();
                if (!string.IsNullOrWhiteSpace(message))
                {
                    messages.Add(message.Trim());
                    continue;
                }
            }

            messages.Add(item.GetRawText());
        }

        return messages.Count == 0
            ? null
            : string.Join("; ", messages);
    }

    private sealed record SalesforceCreateSObjectResponseDto(
        [property: JsonPropertyName("id")] string? Id,
        [property: JsonPropertyName("success")] bool? Success,
        [property: JsonPropertyName("errors")] JsonElement? Errors);
}
