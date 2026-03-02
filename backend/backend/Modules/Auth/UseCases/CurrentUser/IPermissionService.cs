namespace backend.Modules.Auth.UseCases.CurrentUser;

public interface IPermissionService
{
    CurrentUserPermissionsResult GetCurrentUserPermissions(CurrentUserPermissionContext context);
}

public sealed record CurrentUserPermissionContext(
    bool IsAuthenticated,
    bool IsBlocked,
    IReadOnlyCollection<string> Roles);
