namespace backend.Modules.Auth.UseCases.ExternalLogin;

public sealed class StartGoogleLoginUseCase(IExternalAuthService externalAuthService) : IStartGoogleLoginUseCase
{
    public async Task<AuthSessionResult> ExecuteAsync(
        StartGoogleLoginCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var challengeResult = await externalAuthService.StartGoogleChallengeAsync(command, cancellationToken);

        return challengeResult.IsChallenge && challengeResult.Challenge is not null
            ? AuthSessionResult.FromChallenge(challengeResult.Challenge)
            : AuthSessionResult.FromRedirect(challengeResult.RedirectUri);
    }
}
