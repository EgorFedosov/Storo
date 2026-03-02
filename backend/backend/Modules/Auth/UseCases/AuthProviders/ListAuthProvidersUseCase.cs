namespace backend.Modules.Auth.UseCases.AuthProviders;

public sealed class ListAuthProvidersUseCase(IAuthProviderRegistry authProviderRegistry) : IListAuthProvidersUseCase
{
    public Task<ProvidersResult> ExecuteAsync(ListAuthProvidersQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var providers = authProviderRegistry.GetEnabledProviders();
        var result = new ProvidersResult(providers);
        return Task.FromResult(result);
    }
}
