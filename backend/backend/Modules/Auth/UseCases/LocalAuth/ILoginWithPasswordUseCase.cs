namespace backend.Modules.Auth.UseCases.LocalAuth;

public interface ILoginWithPasswordUseCase
{
    Task<LocalAuthResult> ExecuteAsync(
        LoginWithPasswordCommand command,
        CancellationToken cancellationToken);
}
