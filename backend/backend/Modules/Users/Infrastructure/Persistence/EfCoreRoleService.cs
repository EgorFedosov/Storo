using backend.Infrastructure.Persistence;
using backend.Modules.Users.Domain;
using backend.Modules.Users.UseCases.AdminModeration;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Users.Infrastructure.Persistence;

public sealed class EfCoreRoleService(AppDbContext dbContext) : IRoleService
{
    private const string AdminRoleName = "admin";

    public async Task<bool> SetAdminRoleAsync(
        User user,
        bool hasAdminRole,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(user);
        cancellationToken.ThrowIfCancellationRequested();

        var existingAdminRole = user.UserRoles
            .SingleOrDefault(userRole => string.Equals(
                userRole.Role.Name,
                AdminRoleName,
                StringComparison.OrdinalIgnoreCase));

        if (hasAdminRole)
        {
            if (existingAdminRole is not null)
            {
                return false;
            }

            var adminRole = await dbContext.Roles
                .SingleOrDefaultAsync(role => role.Name == AdminRoleName, cancellationToken)
                ?? throw new InvalidOperationException("Role 'admin' is missing.");

            user.UserRoles.Add(new UserRole
            {
                User = user,
                UserId = user.Id,
                Role = adminRole,
                RoleId = adminRole.Id
            });

            return true;
        }

        if (existingAdminRole is null)
        {
            return false;
        }

        user.UserRoles.Remove(existingAdminRole);
        return true;
    }
}
