namespace backend.Modules.Integrations.Infrastructure.Salesforce;

public sealed class SalesforceOptions
{
    public string ClientId { get; init; } = string.Empty;
    public string ClientSecret { get; init; } = string.Empty;
    public string RefreshToken { get; init; } = string.Empty;
    public string InstanceUrl { get; init; } = string.Empty;
    public string AuthBaseUrl { get; init; } = string.Empty;
    public string ApiVersion { get; init; } = "v66.0";

    public static SalesforceOptions FromConfiguration(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var clientId = ResolveRequiredTrimmed(configuration, "SALESFORCE_CLIENT_ID");
        var clientSecret = ResolveRequiredTrimmed(configuration, "SALESFORCE_CLIENT_SECRET");
        var refreshToken = ResolveRequiredTrimmed(configuration, "SALESFORCE_REFRESH_TOKEN");
        var instanceUrl = ResolveRequiredTrimmed(configuration, "SALESFORCE_INSTANCE_URL");
        var authBaseUrl = ResolveRequiredTrimmed(configuration, "SALESFORCE_AUTH_BASE_URL");
        var apiVersion = ResolveRequiredTrimmed(configuration, "SALESFORCE_API_VERSION");

        return new SalesforceOptions
        {
            ClientId = clientId,
            ClientSecret = clientSecret,
            RefreshToken = refreshToken,
            InstanceUrl = NormalizeUrl(instanceUrl, "SALESFORCE_INSTANCE_URL"),
            AuthBaseUrl = NormalizeUrl(authBaseUrl, "SALESFORCE_AUTH_BASE_URL"),
            ApiVersion = NormalizeApiVersion(apiVersion)
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

    private static string NormalizeUrl(string value, string key)
    {
        var normalized = value.Trim().TrimEnd('/');
        if (!Uri.TryCreate(normalized, UriKind.Absolute, out _))
        {
            throw new InvalidOperationException($"Configuration key '{key}' must be an absolute URL.");
        }

        return normalized;
    }

    private static string NormalizeApiVersion(string value)
    {
        var normalized = value.Trim();
        return normalized.StartsWith('v') ? normalized : $"v{normalized}";
    }
}
