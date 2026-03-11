namespace backend.Modules.Inventories.Infrastructure.Storage;

public sealed class SupabaseStorageOptions
{
    public string BaseUrl { get; init; } = string.Empty;
    public string Bucket { get; init; } = string.Empty;
    public string SecretKey { get; init; } = string.Empty;
    public int DefaultListLimit { get; init; } = 100;
    public int MaxUploadSizeBytes { get; init; } = 10 * 1024 * 1024;

    public static SupabaseStorageOptions FromConfiguration(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var baseUrl = ResolveRequired(configuration, "SUPABASE_URL");
        var bucket = ResolveRequired(configuration, "SUPABASE_BUCKET");
        var secretKey = ResolveRequired(configuration, "SUPABASE_SECRET_KEY");
        var defaultListLimit = ResolvePositiveInt(configuration["SUPABASE_DEFAULT_LIST_LIMIT"], 100);
        var maxUploadSizeBytes = ResolvePositiveInt(configuration["SUPABASE_MAX_UPLOAD_SIZE_BYTES"], 10 * 1024 * 1024);

        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out _))
        {
            throw new InvalidOperationException("SUPABASE_URL must be an absolute URL.");
        }

        return new SupabaseStorageOptions
        {
            BaseUrl = baseUrl.TrimEnd('/'),
            Bucket = bucket.Trim(),
            SecretKey = secretKey.Trim(),
            DefaultListLimit = defaultListLimit,
            MaxUploadSizeBytes = maxUploadSizeBytes,
        };
    }

    private static string ResolveRequired(IConfiguration configuration, string key)
    {
        var value = configuration[key];
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        throw new InvalidOperationException($"Required configuration key '{key}' is missing.");
    }

    private static int ResolvePositiveInt(string? rawValue, int fallback)
    {
        return int.TryParse(rawValue, out var parsed) && parsed > 0
            ? parsed
            : fallback;
    }
}
