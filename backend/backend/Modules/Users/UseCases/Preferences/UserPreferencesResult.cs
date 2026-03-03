namespace backend.Modules.Users.UseCases.Preferences;

public sealed record UserPreferencesResult(
    string Language,
    string Theme);
