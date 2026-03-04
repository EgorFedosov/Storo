using backend.Modules.Users.Domain;

namespace backend.Modules.Users.UseCases.AdminModeration;

public interface IRoleService
{
    Task<bool> SetAdminRoleAsync(User user, bool hasAdminRole, CancellationToken cancellationToken);
}
