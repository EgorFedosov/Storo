using System.Globalization;
using backend.Modules.Auth.UseCases.CurrentUser;

namespace backend.Modules.Auth.Api;

public sealed record CurrentUserResponse(
    bool IsAuthenticated,
    CurrentUserIdentityResponse? User,
    IReadOnlyCollection<string> Roles,
    CurrentUserPreferencesResponse Preferences,
    CurrentUserPermissionsResponse Permissions)
{
    public static CurrentUserResponse FromResult(CurrentUserResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new CurrentUserResponse(
            result.IsAuthenticated,
            result.User is null ? null : CurrentUserIdentityResponse.FromResult(result.User),
            result.Roles,
            CurrentUserPreferencesResponse.FromResult(result.Preferences),
            CurrentUserPermissionsResponse.FromResult(result.Permissions));
    }
}

public sealed record CurrentUserIdentityResponse(
    string Id,
    string Email,
    string UserName,
    string DisplayName,
    bool IsBlocked)
{
    public static CurrentUserIdentityResponse FromResult(CurrentUserIdentityResult result) =>
        new(
            result.Id.ToString(CultureInfo.InvariantCulture),
            result.Email,
            result.UserName,
            result.DisplayName,
            result.IsBlocked);
}

public sealed record CurrentUserPreferencesResponse(
    string Language,
    string Theme)
{
    public static CurrentUserPreferencesResponse FromResult(CurrentUserPreferencesResult result) =>
        new(result.Language, result.Theme);
}

public sealed record CurrentUserPermissionsResponse(
    bool IsAdmin,
    bool CanManageUsers,
    bool CanCreateInventory,
    bool CanComment,
    bool CanLike)
{
    public static CurrentUserPermissionsResponse FromResult(CurrentUserPermissionsResult result) =>
        new(
            result.IsAdmin,
            result.CanManageUsers,
            result.CanCreateInventory,
            result.CanComment,
            result.CanLike);
}
