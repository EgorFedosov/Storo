namespace backend.Modules.Auth.UseCases.ExternalLogin;

public interface ICompleteGitHubLoginUseCase
{
    Task<AuthSessionResult> ExecuteAsync(
        CompleteGitHubLoginCommand command,
        CancellationToken cancellationToken);
}
