namespace backend.Modules.Auth.UseCases.ExternalLogin;

public interface ICompleteGoogleLoginUseCase
{
    Task<AuthSessionResult> ExecuteAsync(
        CompleteGoogleLoginCommand command,
        CancellationToken cancellationToken);
}
