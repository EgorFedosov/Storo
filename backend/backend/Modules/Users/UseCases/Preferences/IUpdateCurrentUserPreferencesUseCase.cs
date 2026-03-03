namespace backend.Modules.Users.UseCases.Preferences;

public interface IUpdateCurrentUserPreferencesUseCase
{
    Task<UserPreferencesResult> ExecuteAsync(
        UpdateCurrentUserPreferencesCommand command,
        CancellationToken cancellationToken);
}
