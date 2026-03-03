namespace backend.Modules.Users.UseCases.Preferences;

public sealed record UpdateCurrentUserPreferencesCommand(
    string Language,
    string Theme);
