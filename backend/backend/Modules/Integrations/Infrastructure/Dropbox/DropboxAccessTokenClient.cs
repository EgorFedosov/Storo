using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using backend.Modules.Integrations.UseCases.Dropbox;

namespace backend.Modules.Integrations.Infrastructure.Dropbox;

public sealed class DropboxAccessTokenClient(
    IHttpClientFactory httpClientFactory,
    DropboxOptions options) : IDropboxAccessTokenClient
{
    private static readonly JsonSerializerOptions JsonSerializerOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    public const string HttpClientName = "DropboxApi";

    private readonly HttpClient httpClient = httpClientFactory.CreateClient(HttpClientName);

    public async Task<DropboxAccessTokenResult> GetAccessTokenAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        using var request = new HttpRequestMessage(HttpMethod.Post, BuildTokenEndpoint(options.ApiBaseUrl));
        request.Headers.Authorization = BuildBasicAuthorizationHeader(options.AppKey, options.AppSecret);
        request.Content = new FormUrlEncodedContent(
        [
            KeyValuePair.Create("grant_type", "refresh_token"),
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
                $"Dropbox token request failed with status {(int)response.StatusCode} ({response.ReasonPhrase}). Body: {responseBody}");
        }

        DropboxTokenResponseDto? payload;
        try
        {
            payload = JsonSerializer.Deserialize<DropboxTokenResponseDto>(responseBody, JsonSerializerOptions);
        }
        catch (JsonException exception)
        {
            throw new InvalidOperationException("Dropbox token response has invalid JSON.", exception);
        }

        if (payload is null || string.IsNullOrWhiteSpace(payload.AccessToken))
        {
            throw new InvalidOperationException("Dropbox token response does not contain access_token.");
        }

        if (payload.ExpiresIn <= 0)
        {
            throw new InvalidOperationException("Dropbox token response contains invalid expires_in.");
        }

        var tokenType = string.IsNullOrWhiteSpace(payload.TokenType) ? "Bearer" : payload.TokenType.Trim();
        var scope = string.IsNullOrWhiteSpace(payload.Scope) ? null : payload.Scope.Trim();

        return new DropboxAccessTokenResult(
            payload.AccessToken.Trim(),
            payload.ExpiresIn,
            tokenType,
            scope);
    }

    private static AuthenticationHeaderValue BuildBasicAuthorizationHeader(
        string appKey,
        string appSecret)
    {
        var credentials = $"{appKey}:{appSecret}";
        var base64Credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes(credentials));
        return new AuthenticationHeaderValue("Basic", base64Credentials);
    }

    private static Uri BuildTokenEndpoint(string apiBaseUrl)
    {
        var baseUri = new Uri(apiBaseUrl, UriKind.Absolute);
        var authority = baseUri.GetLeftPart(UriPartial.Authority);
        return new Uri($"{authority}/oauth2/token", UriKind.Absolute);
    }

    private sealed record DropboxTokenResponseDto(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("token_type")] string TokenType,
        [property: JsonPropertyName("expires_in")] int ExpiresIn,
        [property: JsonPropertyName("scope")] string? Scope);
}
