using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using backend.Modules.Integrations.UseCases.Dropbox;

namespace backend.Modules.Integrations.Infrastructure.Dropbox;

public sealed class DropboxUploadClient(
    IHttpClientFactory httpClientFactory,
    DropboxOptions options) : IDropboxUploadClient
{
    private static readonly JsonSerializerOptions JsonSerializerOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient httpClient = httpClientFactory.CreateClient(DropboxAccessTokenClient.HttpClientName);

    public async Task<DropboxUploadResult> UploadJsonAsync(
        DropboxJsonUploadRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        cancellationToken.ThrowIfCancellationRequested();

        var accessToken = request.AccessToken?.Trim();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            throw new InvalidOperationException("Dropbox upload requires a non-empty access token.");
        }

        var fileName = NormalizeFileName(request.FileName);
        var uploadPath = BuildUploadPath(options.RootPath, fileName);
        var uploadBody = Encoding.UTF8.GetBytes(request.JsonPayload ?? string.Empty);

        using var message = new HttpRequestMessage(HttpMethod.Post, BuildUploadEndpoint(options.ContentBaseUrl));
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        message.Headers.Add("Dropbox-API-Arg", BuildUploadArguments(uploadPath));
        message.Content = new ByteArrayContent(uploadBody);
        message.Content.Headers.ContentType = MediaTypeHeaderValue.Parse("application/octet-stream");

        using var response = await httpClient.SendAsync(
            message,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);

        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Dropbox upload request failed with status {(int)response.StatusCode} ({response.ReasonPhrase}). Body: {responseBody}");
        }

        DropboxUploadResponseDto? payload;
        try
        {
            payload = JsonSerializer.Deserialize<DropboxUploadResponseDto>(responseBody, JsonSerializerOptions);
        }
        catch (JsonException exception)
        {
            throw new InvalidOperationException("Dropbox upload response has invalid JSON.", exception);
        }

        if (payload is null || string.IsNullOrWhiteSpace(payload.Id))
        {
            throw new InvalidOperationException("Dropbox upload response does not contain file id.");
        }

        if (string.IsNullOrWhiteSpace(payload.Rev))
        {
            throw new InvalidOperationException("Dropbox upload response does not contain file revision.");
        }

        if (payload.ServerModifiedUtc is null)
        {
            throw new InvalidOperationException("Dropbox upload response does not contain server_modified.");
        }

        if (payload.Size is null || payload.Size < 0)
        {
            throw new InvalidOperationException("Dropbox upload response contains invalid size.");
        }

        var pathDisplay = string.IsNullOrWhiteSpace(payload.PathDisplay)
            ? uploadPath
            : payload.PathDisplay.Trim();

        return new DropboxUploadResult(
            payload.Id.Trim(),
            pathDisplay,
            payload.Rev.Trim(),
            payload.ServerModifiedUtc.Value,
            payload.Size.Value);
    }

    private static Uri BuildUploadEndpoint(string contentBaseUrl)
    {
        return new Uri($"{contentBaseUrl}/files/upload", UriKind.Absolute);
    }

    private static string BuildUploadArguments(string uploadPath)
    {
        return JsonSerializer.Serialize(new
        {
            path = uploadPath,
            mode = "add",
            autorename = true,
            mute = false
        });
    }

    private static string BuildUploadPath(string rootPath, string fileName)
    {
        return string.Equals(rootPath, "/", StringComparison.Ordinal)
            ? $"/{fileName}"
            : $"{rootPath}/{fileName}";
    }

    private static string NormalizeFileName(string rawFileName)
    {
        var fileName = rawFileName?.Trim();
        if (string.IsNullOrWhiteSpace(fileName))
        {
            throw new InvalidOperationException("Dropbox upload requires a non-empty file name.");
        }

        fileName = fileName.TrimStart('/');
        if (fileName.IndexOfAny(['/', '\\']) >= 0)
        {
            throw new InvalidOperationException("Dropbox upload file name must not contain path separators.");
        }

        return fileName;
    }

    private sealed record DropboxUploadResponseDto(
        [property: JsonPropertyName("id")] string Id,
        [property: JsonPropertyName("path_display")] string? PathDisplay,
        [property: JsonPropertyName("rev")] string Rev,
        [property: JsonPropertyName("server_modified")] DateTime? ServerModifiedUtc,
        [property: JsonPropertyName("size")] long? Size);
}
