using backend.Infrastructure.Persistence;
using backend.Modules.Users.Domain;
using backend.Modules.Users.UseCases.Preferences;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Users.Infrastructure.Persistence;

public sealed class EfCoreUserRepository(AppDbContext dbContext) : IUserRepository
{
    public Task<User?> GetByIdAsync(long userId, CancellationToken cancellationToken)
    {
        return dbContext.Users
            .SingleOrDefaultAsync(user => user.Id == userId, cancellationToken);
    }
}
