using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using backend.Modules.Inventories.UseCases.ImageUpload;
using Microsoft.Extensions.Options;

namespace backend.Modules.Inventories.Infrastructure.Storage;

public sealed class ConfigurationImageStoragePresignService : IImageStoragePresignService
{
    private const int DefaultTtlMinutes = 15;
    private const string DefaultPathPrefix = "inventory-images";
    private const string PutMethod = "PUT";

    private readonly ImageStoragePresignOptions _options;
    private readonly Uri _uploadBaseUri;
    private readonly Uri _publicBaseUri;

    public ConfigurationImageStoragePresignService(IOptions<ImageStoragePresignOptions> options)
    {
        ArgumentNullException.ThrowIfNull(options);

        _options = options.Value ?? throw new InvalidOperationException("Image storage options were not configured.");
        _uploadBaseUri = ParseAbsoluteUri(_options.UploadBaseUrl, nameof(_options.UploadBaseUrl));
        _publicBaseUri = ParseAbsoluteUri(_options.PublicBaseUrl, nameof(_options.PublicBaseUrl));
    }

    public Task<ImageStoragePresignData> CreatePresignAsync(
        ImageStoragePresignRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        cancellationToken.ThrowIfCancellationRequested();

        var now = DateTime.UtcNow;
        var fileName = SanitizeFileName(request.FileName);
        var objectKey = BuildObjectKey(request.ActorUserId, fileName, now);
        var expiresAtUtc = now.AddMinutes(GetTtlMinutes());
        var expiresAtUnix = new DateTimeOffset(expiresAtUtc).ToUnixTimeSeconds();
        var signature = CreateSignature(objectKey, request.ContentType, request.Size, expiresAtUnix);

        var uploadPath = $"{objectKey}?expires={expiresAtUnix.ToString(CultureInfo.InvariantCulture)}&signature={signature}";
        var uploadUrl = BuildUri(_uploadBaseUri, uploadPath).ToString();
        var publicUrl = BuildUri(_publicBaseUri, objectKey).ToString();

        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Content-Type"] = request.ContentType
        };

        return Task.FromResult(
            new ImageStoragePresignData(
                uploadUrl,
                PutMethod,
                headers,
                new Dictionary<string, string>(StringComparer.Ordinal),
                publicUrl,
                expiresAtUtc));
    }

    private int GetTtlMinutes()
    {
        return _options.UrlTtlMinutes > 0
            ? _options.UrlTtlMinutes
            : DefaultTtlMinutes;
    }

    private string BuildObjectKey(long actorUserId, string fileName, DateTime now)
    {
        var pathPrefix = NormalizePathPrefix(_options.PathPrefix);
        return string.Create(
            CultureInfo.InvariantCulture,
            $"{pathPrefix}/u{actorUserId:0}/{now:yyyy/MM/dd}/{Guid.NewGuid():N}-{fileName}");
    }

    private static string NormalizePathPrefix(string? rawPrefix)
    {
        if (string.IsNullOrWhiteSpace(rawPrefix))
        {
            return DefaultPathPrefix;
        }

        var normalized = rawPrefix.Trim().Trim('/');
        return string.IsNullOrWhiteSpace(normalized)
            ? DefaultPathPrefix
            : normalized;
    }

    private string CreateSignature(string objectKey, string contentType, long size, long expiresAtUnix)
    {
        var payload = string.Create(
            CultureInfo.InvariantCulture,
            $"{objectKey}\n{contentType}\n{size}\n{expiresAtUnix}");

        var payloadBytes = Encoding.UTF8.GetBytes(payload);

        if (!string.IsNullOrWhiteSpace(_options.SigningSecret))
        {
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_options.SigningSecret));
            return Convert.ToHexString(hmac.ComputeHash(payloadBytes)).ToLowerInvariant();
        }

        return Convert.ToHexString(SHA256.HashData(payloadBytes)).ToLowerInvariant();
    }

    private static string SanitizeFileName(string rawFileName)
    {
        var candidate = Path.GetFileName(rawFileName).Trim();
        if (string.IsNullOrWhiteSpace(candidate))
        {
            return "image";
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
        return string.IsNullOrWhiteSpace(sanitized) ? "image" : sanitized;
    }

    private static Uri ParseAbsoluteUri(string value, string settingName)
    {
        if (Uri.TryCreate(value, UriKind.Absolute, out var uri))
        {
            return uri;
        }

        throw new InvalidOperationException(
            $"Image upload setting '{settingName}' must be an absolute URL.");
    }

    private static Uri BuildUri(Uri baseUri, string pathAndQuery)
    {
        var normalizedBase = baseUri.ToString().TrimEnd('/') + "/";
        return new Uri(new Uri(normalizedBase, UriKind.Absolute), pathAndQuery);
    }
}
