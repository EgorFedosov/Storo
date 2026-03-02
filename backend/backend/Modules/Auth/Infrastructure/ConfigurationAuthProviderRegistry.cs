using backend.Modules.Auth.UseCases.AuthProviders;

namespace backend.Modules.Auth.Infrastructure;

public sealed class ConfigurationAuthProviderRegistry(IConfiguration configuration) : IAuthProviderRegistry
{
    private static readonly string[] DefaultProviders = ["google"];

    public IReadOnlyCollection<string> GetEnabledProviders()
    {
        var configuredProviders = configuration.GetSection("Auth:ExternalProviders").Get<string[]>();
        var sourceProviders = configuredProviders is { Length: > 0 } ? configuredProviders : DefaultProviders;

        var normalizedProviders = sourceProviders
            .Where(static provider => !string.IsNullOrWhiteSpace(provider))
            .Select(static provider => provider.Trim().ToLowerInvariant())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        return normalizedProviders.Length > 0
            ? normalizedProviders
            : DefaultProviders;
    }
}
