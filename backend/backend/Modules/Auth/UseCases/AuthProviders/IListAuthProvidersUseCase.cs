namespace backend.Modules.Auth.UseCases.AuthProviders;

public interface IListAuthProvidersUseCase
{
    Task<ProvidersResult> ExecuteAsync(ListAuthProvidersQuery query, CancellationToken cancellationToken);
}
