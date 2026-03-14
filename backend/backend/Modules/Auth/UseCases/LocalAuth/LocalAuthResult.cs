using backend.Modules.Auth.UseCases.ExternalLogin;

namespace backend.Modules.Auth.UseCases.LocalAuth;

public enum LocalAuthStatus
{
    Succeeded = 0,
    InvalidCredentials = 1,
    LoginAlreadyTaken = 2,
    UserBlocked = 3,
}

public sealed record LocalAuthResult(
    LocalAuthStatus Status,
    AuthenticatedUser? User = null)
{
    public static LocalAuthResult Success(AuthenticatedUser user)
    {
        ArgumentNullException.ThrowIfNull(user);
        return new LocalAuthResult(LocalAuthStatus.Succeeded, user);
    }

    public static LocalAuthResult Fail(LocalAuthStatus status)
    {
        return new LocalAuthResult(status);
    }
}
