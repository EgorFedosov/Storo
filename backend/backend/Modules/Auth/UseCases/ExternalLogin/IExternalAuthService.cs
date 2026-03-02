using Microsoft.AspNetCore.Authentication;

namespace backend.Modules.Auth.UseCases.ExternalLogin;

public interface IExternalAuthService
{
    Task<ExternalAuthChallengeResult> StartGoogleChallengeAsync(
        StartGoogleLoginCommand command,
        CancellationToken cancellationToken);

    Task<ExternalAuthCallbackResult> CompleteGoogleAuthenticationAsync(
        CompleteGoogleLoginCommand command,
        CancellationToken cancellationToken);

    Task ClearExternalStateAsync(CancellationToken cancellationToken);

    string BuildErrorRedirectUri(string errorCode);
}

public sealed record ExternalAuthChallenge(
    string Scheme,
    AuthenticationProperties Properties);

public sealed record ExternalAuthChallengeResult(
    bool IsChallenge,
    string RedirectUri,
    ExternalAuthChallenge? Challenge = null)
{
    public static ExternalAuthChallengeResult Ready(ExternalAuthChallenge challenge)
    {
        ArgumentNullException.ThrowIfNull(challenge);
        return new ExternalAuthChallengeResult(true, string.Empty, challenge);
    }

    public static ExternalAuthChallengeResult Redirect(string redirectUri)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(redirectUri);
        return new ExternalAuthChallengeResult(false, redirectUri);
    }
}

public sealed record ExternalAuthCallbackResult(
    bool IsAuthenticated,
    string RedirectUri,
    ExternalAuthIdentity? Identity = null)
{
    public static ExternalAuthCallbackResult Authenticated(string redirectUri, ExternalAuthIdentity identity)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(redirectUri);
        ArgumentNullException.ThrowIfNull(identity);
        return new ExternalAuthCallbackResult(true, redirectUri, identity);
    }

    public static ExternalAuthCallbackResult Redirect(string redirectUri)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(redirectUri);
        return new ExternalAuthCallbackResult(false, redirectUri);
    }
}

public sealed record ExternalAuthIdentity(
    string Provider,
    string ProviderUserId,
    string Email,
    string DisplayName);
