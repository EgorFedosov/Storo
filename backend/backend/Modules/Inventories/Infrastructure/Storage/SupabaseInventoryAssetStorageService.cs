using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using backend.Modules.Inventories.UseCases.ImageUpload;

namespace backend.Modules.Inventories.Infrastructure.Storage;

public sealed class SupabaseInventoryAssetStorageService(
    IHttpClientFactory httpClientFactory,
    SupabaseStorageOptions options) : IInventoryAssetStorageService
{
    private static readonly JsonSerializerOptions JsonSerializerOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    public const string HttpClientName = "SupabaseStorage";

    private readonly HttpClient _httpClient = httpClientFactory.CreateClient(HttpClientName);

    public async Task<InventoryAssetUploadResult> UploadAsync(
        InventoryAssetUploadRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        cancellationToken.ThrowIfCancellationRequested();

        var sanitizedFileName = SanitizeFileName(request.FileName);
        var objectPath = BuildObjectPath(request.ActorUserId, sanitizedFileName, DateTime.UtcNow);
        var uploadRequestUri = BuildStorageObjectUri(objectPath);

        using var message = new HttpRequestMessage(HttpMethod.Post, uploadRequestUri);
        AddAuthHeaders(message);
        message.Headers.Add("x-upsert", "false");

        using var content = new StreamContent(request.Content);
        content.Headers.ContentType = MediaTypeHeaderValue.Parse(request.ContentType);
        message.Content = content;

        using var response = await _httpClient.SendAsync(message, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException(
                $"Supabase upload failed with status {(int)response.StatusCode} ({response.ReasonPhrase}). Body: {body}");
        }

        var publicUrl = BuildPublicObjectUrl(objectPath);
        return new InventoryAssetUploadResult(
            publicUrl,
            objectPath,
            sanitizedFileName,
            request.ContentType,
            request.Size);
    }

    public async Task DeleteByPublicUrlAsync(
        string publicUrl,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!TryExtractObjectPath(publicUrl, out var objectPath))
        {
            throw new InvalidOperationException("publicUrl is not a valid Supabase public object URL.");
        }

        var deleteRequestUri = BuildStorageObjectUri(objectPath);
        using var message = new HttpRequestMessage(HttpMethod.Delete, deleteRequestUri);
        AddAuthHeaders(message);

        using var response = await _httpClient.SendAsync(message, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return;
        }

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException(
                $"Supabase delete failed with status {(int)response.StatusCode} ({response.ReasonPhrase}). Body: {body}");
        }
    }

    public async Task<IReadOnlyList<InventoryAssetListItemResult>> ListAsync(
        int limit,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var effectiveLimit = Math.Max(1, limit);

        var requestUri = $"{options.BaseUrl}/storage/v1/object/list/{Uri.EscapeDataString(options.Bucket)}";
        using var message = new HttpRequestMessage(HttpMethod.Post, requestUri);
        AddAuthHeaders(message);
        message.Content = new StringContent(
            JsonSerializer.Serialize(new { limit = effectiveLimit }),
            Encoding.UTF8,
            "application/json");

        using var response = await _httpClient.SendAsync(message, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException(
                $"Supabase list failed with status {(int)response.StatusCode} ({response.ReasonPhrase}). Body: {body}");
        }

        var payload = await response.Content.ReadAsStringAsync(cancellationToken);
        return ParseListPayload(payload);
    }

    private void AddAuthHeaders(HttpRequestMessage message)
    {
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.SecretKey);
        message.Headers.Add("apikey", options.SecretKey);
    }

    private string BuildStorageObjectUri(string objectPath)
    {
        var encodedBucket = Uri.EscapeDataString(options.Bucket);
        var encodedPath = EncodeObjectPath(objectPath);
        return $"{options.BaseUrl}/storage/v1/object/{encodedBucket}/{encodedPath}";
    }

    private string BuildPublicObjectUrl(string objectPath)
    {
        var encodedBucket = Uri.EscapeDataString(options.Bucket);
        var encodedPath = EncodeObjectPath(objectPath);
        return $"{options.BaseUrl}/storage/v1/object/public/{encodedBucket}/{encodedPath}";
    }

    private bool TryExtractObjectPath(string rawPublicUrl, out string objectPath)
    {
        objectPath = string.Empty;

        if (!Uri.TryCreate(rawPublicUrl, UriKind.Absolute, out var parsedUri))
        {
            return false;
        }

        if (!Uri.TryCreate(options.BaseUrl, UriKind.Absolute, out var configuredBaseUri))
        {
            return false;
        }

        if (!string.Equals(parsedUri.Host, configuredBaseUri.Host, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var expectedPrefix = $"/storage/v1/object/public/{Uri.EscapeDataString(options.Bucket)}/";
        if (!parsedUri.AbsolutePath.StartsWith(expectedPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var encodedObjectPath = parsedUri.AbsolutePath[expectedPrefix.Length..].Trim();
        if (encodedObjectPath.Length == 0)
        {
            return false;
        }

        objectPath = Uri.UnescapeDataString(encodedObjectPath);
        return objectPath.Length > 0;
    }

    private static string BuildObjectPath(long actorUserId, string fileName, DateTime now)
    {
        return string.Create(
            CultureInfo.InvariantCulture,
            $"inventory-assets/u{actorUserId:0}/{now:yyyy/MM/dd}/{Guid.NewGuid():N}-{fileName}");
    }

    private static string SanitizeFileName(string rawFileName)
    {
        var candidate = Path.GetFileName(rawFileName).Trim();
        if (candidate.Length == 0)
        {
            return "file";
        }

        Span<char> buffer = stackalloc char[candidate.Length];
        var index = 0;
        foreach (var ch in candidate)
        {
            if (char.IsAsciiLetterOrDigit(ch) || ch is '.' or '-' or '_')
            {
                buffer[index++] = char.ToLowerInvariant(ch);
                continue;
            }

            buffer[index++] = '-';
        }

        var sanitized = new string(buffer[..index]).Trim('-');
        return sanitized.Length > 0 ? sanitized : "file";
    }

    private static string EncodeObjectPath(string objectPath)
    {
        return string.Join(
            "/",
            objectPath
                .Split('/', StringSplitOptions.RemoveEmptyEntries)
                .Select(Uri.EscapeDataString));
    }

    private IReadOnlyList<InventoryAssetListItemResult> ParseListPayload(string payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
        {
            return Array.Empty<InventoryAssetListItemResult>();
        }

        try
        {
            var items = JsonSerializer.Deserialize<List<SupabaseListItemDto>>(payload, JsonSerializerOptions)
                        ?? [];

            return items
                .Where(item => !string.IsNullOrWhiteSpace(item.Name))
                .Select(item => new InventoryAssetListItemResult(
                    item.Name!,
                    BuildPublicObjectUrl(item.Name!),
                    item.Metadata?.Size,
                    item.UpdatedAtUtc))
                .ToArray();
        }
        catch (JsonException)
        {
            return Array.Empty<InventoryAssetListItemResult>();
        }
    }

    private sealed record SupabaseListItemDto(
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("updated_at")] DateTime? UpdatedAtUtc,
        [property: JsonPropertyName("metadata")] SupabaseListItemMetadataDto? Metadata);

    private sealed record SupabaseListItemMetadataDto(
        [property: JsonPropertyName("size")] long? Size);
}
