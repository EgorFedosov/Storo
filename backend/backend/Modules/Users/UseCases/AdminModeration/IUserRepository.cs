using backend.Modules.Users.Domain;

namespace backend.Modules.Users.UseCases.AdminModeration;

public interface IUserRepository
{
    Task<User?> GetByIdWithRolesAsync(long userId, CancellationToken cancellationToken);

    void Delete(User user);
}
