namespace backend.Modules.Auth.UseCases.CurrentUser;

public sealed record CurrentUserResult(
    bool IsAuthenticated,
    CurrentUserIdentityResult? User,
    IReadOnlyCollection<string> Roles,
    CurrentUserPreferencesResult Preferences,
    CurrentUserPermissionsResult Permissions);

public sealed record CurrentUserIdentityResult(
    long Id,
    string Email,
    string UserName,
    string DisplayName,
    bool IsBlocked);

public sealed record CurrentUserPreferencesResult(
    string Language,
    string Theme);

public sealed record CurrentUserPermissionsResult(
    bool IsAdmin,
    bool CanManageUsers,
    bool CanCreateInventory,
    bool CanComment,
    bool CanLike);
