using backend.Infrastructure.Persistence;
using backend.Modules.Auth.UseCases.CurrentUser;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Auth.Infrastructure;

public sealed class EfCoreUserReadRepository(AppDbContext dbContext) : IUserReadRepository
{
    public async Task<CurrentUserReadModel?> GetByIdAsync(long userId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        return await dbContext.Users
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => new CurrentUserReadModel(
                user.Id,
                user.Email,
                user.UserName,
                user.DisplayName,
                user.IsBlocked,
                user.PreferredLanguage,
                user.PreferredTheme,
                user.UserRoles
                    .Select(userRole => userRole.Role.Name)
                    .ToArray()))
            .SingleOrDefaultAsync(cancellationToken);
    }
}
