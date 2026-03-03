using backend.Modules.Users.UseCases.Preferences;

namespace backend.Modules.Users.Api;

public sealed record UserPreferencesResponse(
    string Language,
    string Theme)
{
    public static UserPreferencesResponse FromResult(UserPreferencesResult result)
    {
        ArgumentNullException.ThrowIfNull(result);
        return new UserPreferencesResponse(result.Language, result.Theme);
    }
}

public sealed record UpdatePreferencesRequest(
    string? Language,
    string? Theme);
