namespace backend.Modules.Auth.UseCases.Logout;

public interface ILogoutUseCase
{
    Task<LogoutResult> ExecuteAsync(LogoutCommand command, CancellationToken cancellationToken);
}
