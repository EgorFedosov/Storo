using backend.Modules.Auth.UseCases.AuthProviders;

namespace backend.Modules.Auth.Infrastructure;

public sealed class ConfigurationAuthProviderRegistry(IConfiguration configuration) : IAuthProviderRegistry
{
    public IReadOnlyCollection<string> GetEnabledProviders()
    {
        var configuredProviders = configuration.GetSection("Auth:ExternalProviders").Get<string[]>();
        var sourceProviders = configuredProviders is { Length: > 0 }
            ? configuredProviders
            : ["google", "github"];

        var googleConfigured =
            !string.IsNullOrWhiteSpace(configuration["Authentication:Google:ClientId"]) &&
            !string.IsNullOrWhiteSpace(configuration["Authentication:Google:ClientSecret"]);
        var gitHubConfigured =
            !string.IsNullOrWhiteSpace(configuration["Authentication:GitHub:ClientId"]) &&
            !string.IsNullOrWhiteSpace(configuration["Authentication:GitHub:ClientSecret"]);

        var normalizedProviders = sourceProviders
            .Where(static provider => !string.IsNullOrWhiteSpace(provider))
            .Select(static provider => provider.Trim().ToLowerInvariant())
            .Where(provider => provider switch
            {
                "google" => googleConfigured,
                "github" => gitHubConfigured,
                _ => false
            })
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        return normalizedProviders;
    }
}
