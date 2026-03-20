using System.Text.Json;
using System.Text.Json.Serialization;
using backend.Modules.Integrations.UseCases.Salesforce;

namespace backend.Modules.Integrations.Infrastructure.Salesforce;

public sealed class SalesforceAccessTokenClient(
    IHttpClientFactory httpClientFactory,
    SalesforceOptions options) : ISalesforceAccessTokenClient
{
    private static readonly JsonSerializerOptions JsonSerializerOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    public const string HttpClientName = "SalesforceApi";

    private readonly HttpClient httpClient = httpClientFactory.CreateClient(HttpClientName);

    public async Task<SalesforceAccessTokenResult> GetAccessTokenAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        using var request = new HttpRequestMessage(HttpMethod.Post, BuildTokenEndpoint(options.AuthBaseUrl));
        request.Content = new FormUrlEncodedContent(
        [
            KeyValuePair.Create("grant_type", "refresh_token"),
            KeyValuePair.Create("client_id", options.ClientId),
            KeyValuePair.Create("client_secret", options.ClientSecret),
            KeyValuePair.Create("refresh_token", options.RefreshToken)
        ]);

        using var response = await httpClient.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);

        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Salesforce token request failed with status {(int)response.StatusCode} ({response.ReasonPhrase}). Body: {responseBody}");
        }

        SalesforceTokenResponseDto? payload;
        try
        {
            payload = JsonSerializer.Deserialize<SalesforceTokenResponseDto>(responseBody, JsonSerializerOptions);
        }
        catch (JsonException exception)
        {
            throw new InvalidOperationException("Salesforce token response has invalid JSON.", exception);
        }

        var accessToken = payload?.AccessToken?.Trim();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            throw new InvalidOperationException("Salesforce token response does not contain access_token.");
        }

        var tokenType = string.IsNullOrWhiteSpace(payload?.TokenType)
            ? "Bearer"
            : payload.TokenType.Trim();

        return new SalesforceAccessTokenResult(accessToken, tokenType);
    }

    private static Uri BuildTokenEndpoint(string authBaseUrl)
    {
        var baseUri = new Uri(authBaseUrl, UriKind.Absolute);
        var authority = baseUri.GetLeftPart(UriPartial.Authority);
        return new Uri($"{authority}/services/oauth2/token", UriKind.Absolute);
    }

    private sealed record SalesforceTokenResponseDto(
        [property: JsonPropertyName("access_token")] string? AccessToken,
        [property: JsonPropertyName("token_type")] string? TokenType);
}
