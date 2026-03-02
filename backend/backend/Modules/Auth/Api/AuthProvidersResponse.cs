using backend.Modules.Auth.UseCases.AuthProviders;

namespace backend.Modules.Auth.Api;

public sealed record AuthProvidersResponse(IReadOnlyCollection<string> Providers)
{
    public static AuthProvidersResponse FromResult(ProvidersResult result) =>
        new(result.Providers);
}
