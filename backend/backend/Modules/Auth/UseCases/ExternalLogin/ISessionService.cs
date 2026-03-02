namespace backend.Modules.Auth.UseCases.ExternalLogin;

public interface ISessionService
{
    Task SignInAsync(AuthenticatedUser user, CancellationToken cancellationToken);
    Task SignOutAsync(CancellationToken cancellationToken);
}
