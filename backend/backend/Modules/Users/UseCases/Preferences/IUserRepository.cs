using backend.Modules.Users.Domain;

namespace backend.Modules.Users.UseCases.Preferences;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(long userId, CancellationToken cancellationToken);
}
