namespace backend.Modules.Auth.UseCases.ExternalLogin;

public interface IStartGitHubLoginUseCase
{
    Task<AuthSessionResult> ExecuteAsync(
        StartGitHubLoginCommand command,
        CancellationToken cancellationToken);
}
