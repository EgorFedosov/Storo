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

        return new SalesforceOptions
        {
            ClientId = Resolve(configuration, "SALESFORCE_CLIENT_ID"),
            ClientSecret = Resolve(configuration, "SALESFORCE_CLIENT_SECRET"),
            RefreshToken = Resolve(configuration, "SALESFORCE_REFRESH_TOKEN"),
            InstanceUrl = NormalizeUrl(Resolve(configuration, "SALESFORCE_INSTANCE_URL")),
            AuthBaseUrl = NormalizeUrl(Resolve(configuration, "SALESFORCE_AUTH_BASE_URL")),
            ApiVersion = NormalizeApiVersion(configuration["SALESFORCE_API_VERSION"])
        };
    }

    private static string Resolve(IConfiguration configuration, string key)
    {
        var value = configuration[key];
        return string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim();
    }

    private static string NormalizeUrl(string value)
    {
        return value.Trim().TrimEnd('/');
    }

    private static string NormalizeApiVersion(string? value)
    {
        var normalized = string.IsNullOrWhiteSpace(value)
            ? "v66.0"
            : value.Trim();

        return normalized.StartsWith('v') ? normalized : $"v{normalized}";
    }
}
