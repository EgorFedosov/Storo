namespace backend.Modules.Auth.UseCases.ExternalLogin;

public enum AuthSessionStatus
{
    Challenge = 1,
    Redirect = 2
}

public sealed record AuthSessionResult(
    AuthSessionStatus Status,
    string RedirectUri,
    ExternalAuthChallenge? Challenge = null)
{
    public static AuthSessionResult FromChallenge(ExternalAuthChallenge challenge)
    {
        ArgumentNullException.ThrowIfNull(challenge);
        return new AuthSessionResult(AuthSessionStatus.Challenge, string.Empty, challenge);
    }

    public static AuthSessionResult FromRedirect(string redirectUri)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(redirectUri);
        return new AuthSessionResult(AuthSessionStatus.Redirect, redirectUri);
    }
}
