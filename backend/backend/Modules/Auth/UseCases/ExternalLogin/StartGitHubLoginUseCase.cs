namespace backend.Modules.Auth.UseCases.ExternalLogin;

public sealed class StartGitHubLoginUseCase(IExternalAuthService externalAuthService) : IStartGitHubLoginUseCase
{
    public async Task<AuthSessionResult> ExecuteAsync(
        StartGitHubLoginCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var challengeResult = await externalAuthService.StartGitHubChallengeAsync(command, cancellationToken);

        return challengeResult.IsChallenge && challengeResult.Challenge is not null
            ? AuthSessionResult.FromChallenge(challengeResult.Challenge)
            : AuthSessionResult.FromRedirect(challengeResult.RedirectUri);
    }
}
