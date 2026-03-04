using backend.Infrastructure.Persistence;
using backend.Modules.Users.Domain;
using backend.Modules.Users.UseCases.AdminModeration;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Users.Infrastructure.Persistence;

public sealed class EfCoreAdminModerationUserRepository(AppDbContext dbContext) : IUserRepository
{
    public Task<User?> GetByIdWithRolesAsync(long userId, CancellationToken cancellationToken)
    {
        return dbContext.Users
            .Include(user => user.UserRoles)
                .ThenInclude(userRole => userRole.Role)
            .SingleOrDefaultAsync(user => user.Id == userId, cancellationToken);
    }

    public void Delete(User user)
    {
        ArgumentNullException.ThrowIfNull(user);
        dbContext.Users.Remove(user);
    }
}
