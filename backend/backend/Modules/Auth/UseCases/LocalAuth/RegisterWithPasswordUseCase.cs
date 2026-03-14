using backend.Modules.Auth.UseCases.ExternalLogin;

namespace backend.Modules.Auth.UseCases.LocalAuth;

public sealed class RegisterWithPasswordUseCase(
    ILocalCredentialsRepository localCredentialsRepository,
    ISessionService sessionService) : IRegisterWithPasswordUseCase
{
    public async Task<LocalAuthResult> ExecuteAsync(
        RegisterWithPasswordCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var result = await localCredentialsRepository.RegisterAsync(
            command.Login,
            command.Password,
            cancellationToken);

        if (result.Status == LocalAuthStatus.Succeeded && result.User is not null)
        {
            await sessionService.SignInAsync(result.User, cancellationToken);
        }

        return result;
    }
}
