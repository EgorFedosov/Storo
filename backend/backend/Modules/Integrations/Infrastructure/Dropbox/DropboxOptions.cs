namespace backend.Modules.Integrations.Infrastructure.Dropbox;

public sealed class DropboxOptions
{
    public string AppKey { get; init; } = string.Empty;
    public string AppSecret { get; init; } = string.Empty;
    public string RefreshToken { get; init; } = string.Empty;
    public string RootPath { get; init; } = "/storo-support";
    public string ApiBaseUrl { get; init; } = "https://api.dropboxapi.com/2";
    public string ContentBaseUrl { get; init; } = "https://content.dropboxapi.com/2";
    public bool UseRefreshToken { get; init; } = true;

    public static DropboxOptions FromConfiguration(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var rootPath = ReadTrimmed(configuration, "DROPBOX_ROOT_PATH", "/storo-support");

        return new DropboxOptions
        {
            AppKey = ReadTrimmed(configuration, "DROPBOX_APP_KEY"),
            AppSecret = ReadTrimmed(configuration, "DROPBOX_APP_SECRET"),
            RefreshToken = ReadTrimmed(configuration, "DROPBOX_REFRESH_TOKEN"),
            RootPath = NormalizeRootPath(rootPath),
            ApiBaseUrl = NormalizeBaseUrl(ReadTrimmed(configuration, "DROPBOX_API_BASE_URL", "https://api.dropboxapi.com/2")),
            ContentBaseUrl = NormalizeBaseUrl(ReadTrimmed(configuration, "DROPBOX_CONTENT_BASE_URL", "https://content.dropboxapi.com/2")),
            UseRefreshToken = ParseBoolean(configuration["DROPBOX_USE_REFRESH_TOKEN"], fallback: true),
        };
    }

    private static string ReadTrimmed(IConfiguration configuration, string key, string fallback = "")
    {
        var rawValue = configuration[key];
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return fallback;
        }

        return rawValue.Trim();
    }

    private static string NormalizeBaseUrl(string url)
    {
        return url.Trim().TrimEnd('/');
    }

    private static string NormalizeRootPath(string rootPath)
    {
        var normalized = rootPath.Trim();
        if (normalized.Length == 0)
        {
            return "/";
        }

        return normalized.StartsWith("/", StringComparison.Ordinal) ? normalized : $"/{normalized}";
    }

    private static bool ParseBoolean(string? rawValue, bool fallback)
    {
        return bool.TryParse(rawValue, out var parsed)
            ? parsed
            : fallback;
    }
}
