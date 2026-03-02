using backend.Modules.Auth.UseCases.CurrentUser;

namespace backend.Modules.Auth.Infrastructure;

public sealed class DefaultPermissionService : IPermissionService
{
    private const string AdminRoleName = "admin";

    public CurrentUserPermissionsResult GetCurrentUserPermissions(CurrentUserPermissionContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var isActiveUser = context.IsAuthenticated && !context.IsBlocked;
        var isAdmin = isActiveUser
                      && context.Roles.Any(
                          role => string.Equals(role, AdminRoleName, StringComparison.OrdinalIgnoreCase));

        return new CurrentUserPermissionsResult(
            isAdmin,
            isAdmin,
            isActiveUser,
            isActiveUser,
            isActiveUser);
    }
}
