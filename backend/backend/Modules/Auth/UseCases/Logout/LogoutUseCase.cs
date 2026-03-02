using backend.Modules.Auth.UseCases.ExternalLogin;

namespace backend.Modules.Auth.UseCases.Logout;

public sealed class LogoutUseCase(ISessionService sessionService) : ILogoutUseCase
{
    public async Task<LogoutResult> ExecuteAsync(LogoutCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        await sessionService.SignOutAsync(cancellationToken);
        return new LogoutResult();
    }
}
