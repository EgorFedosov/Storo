namespace backend.Modules.Auth.UseCases.LocalAuth;

public interface IRegisterWithPasswordUseCase
{
    Task<LocalAuthResult> ExecuteAsync(
        RegisterWithPasswordCommand command,
        CancellationToken cancellationToken);
}
