namespace backend.Modules.Auth.UseCases.Authorization;

public interface IAuthorizationCheckUseCase
{
    Task<AuthorizationCheckResult> ExecuteAsync(AuthorizationCheck check, CancellationToken cancellationToken);
}
