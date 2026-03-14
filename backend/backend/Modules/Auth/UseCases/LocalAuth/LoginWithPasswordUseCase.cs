using backend.Modules.Auth.UseCases.ExternalLogin;

namespace backend.Modules.Auth.UseCases.LocalAuth;

public sealed class LoginWithPasswordUseCase(
    ILocalCredentialsRepository localCredentialsRepository,
    ISessionService sessionService) : ILoginWithPasswordUseCase
{
    public async Task<LocalAuthResult> ExecuteAsync(
        LoginWithPasswordCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var result = await localCredentialsRepository.AuthenticateAsync(
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
