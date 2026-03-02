namespace backend.Modules.Auth.UseCases.ExternalLogin;

public interface IStartGoogleLoginUseCase
{
    Task<AuthSessionResult> ExecuteAsync(
        StartGoogleLoginCommand command,
        CancellationToken cancellationToken);
}
