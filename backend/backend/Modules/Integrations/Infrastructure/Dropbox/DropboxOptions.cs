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

        var appKey = ResolveRequiredTrimmed(configuration, "DROPBOX_APP_KEY");
        var appSecret = ResolveRequiredTrimmed(configuration, "DROPBOX_APP_SECRET");
        var refreshToken = ResolveRequiredTrimmed(configuration, "DROPBOX_REFRESH_TOKEN");
        var rootPath = ResolveRequiredTrimmed(configuration, "DROPBOX_ROOT_PATH");
        var apiBaseUrl = ResolveRequiredTrimmed(configuration, "DROPBOX_API_BASE_URL");
        var contentBaseUrl = ResolveRequiredTrimmed(configuration, "DROPBOX_CONTENT_BASE_URL");
        var useRefreshToken = ResolveRequiredBoolean(configuration, "DROPBOX_USE_REFRESH_TOKEN");
        if (!useRefreshToken)
        {
            throw new InvalidOperationException("DROPBOX_USE_REFRESH_TOKEN must be true for Dropbox integration.");
        }

        return new DropboxOptions
        {
            AppKey = appKey,
            AppSecret = appSecret,
            RefreshToken = refreshToken,
            RootPath = NormalizeRootPath(rootPath),
            ApiBaseUrl = NormalizeBaseUrl(apiBaseUrl, "DROPBOX_API_BASE_URL"),
            ContentBaseUrl = NormalizeBaseUrl(contentBaseUrl, "DROPBOX_CONTENT_BASE_URL"),
            UseRefreshToken = useRefreshToken,
        };
    }

    private static string ResolveRequiredTrimmed(IConfiguration configuration, string key)
    {
        var rawValue = configuration[key];
        if (!string.IsNullOrWhiteSpace(rawValue))
        {
            return rawValue.Trim();
        }

        throw new InvalidOperationException($"Required configuration key '{key}' is missing.");
    }

    private static bool ResolveRequiredBoolean(IConfiguration configuration, string key)
    {
        var rawValue = configuration[key];
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            throw new InvalidOperationException($"Required configuration key '{key}' is missing.");
        }

        if (bool.TryParse(rawValue.Trim(), out var parsed))
        {
            return parsed;
        }

        throw new InvalidOperationException($"Configuration key '{key}' must be a boolean value.");
    }

    private static string NormalizeBaseUrl(string url, string key)
    {
        var normalized = url.Trim().TrimEnd('/');
        if (!Uri.TryCreate(normalized, UriKind.Absolute, out _))
        {
            throw new InvalidOperationException($"Configuration key '{key}' must be an absolute URL.");
        }

        return normalized;
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
}
