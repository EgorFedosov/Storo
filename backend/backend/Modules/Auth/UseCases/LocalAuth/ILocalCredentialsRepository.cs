namespace backend.Modules.Auth.UseCases.LocalAuth;

public interface ILocalCredentialsRepository
{
    Task<LocalAuthResult> RegisterAsync(
        string login,
        string password,
        CancellationToken cancellationToken);

    Task<LocalAuthResult> AuthenticateAsync(
        string login,
        string password,
        CancellationToken cancellationToken);
}
