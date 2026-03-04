using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Users.Domain;

namespace backend.Modules.Users.UseCases.AdminModeration;

public sealed class AdminModerationUseCase(
    IUserRepository userRepository,
    IRoleService roleService,
    IUnitOfWork unitOfWork)
    : IBlockUserUseCase,
        IUnblockUserUseCase,
        IGrantAdminUseCase,
        IRevokeAdminUseCase,
        IDeleteUserUseCase
{
    public Task<AdminModerationResult> ExecuteAsync(
        BlockUserCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        return SetBlockedStateAsync(
            command.UserId,
            true,
            AdminModerationOperationStatus.Blocked,
            cancellationToken);
    }

    public Task<AdminModerationResult> ExecuteAsync(
        UnblockUserCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        return SetBlockedStateAsync(
            command.UserId,
            false,
            AdminModerationOperationStatus.Unblocked,
            cancellationToken);
    }

    public Task<AdminModerationResult> ExecuteAsync(
        GrantAdminCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        return SetAdminRoleAsync(
            command.UserId,
            true,
            AdminModerationOperationStatus.AdminGranted,
            cancellationToken);
    }

    public Task<AdminModerationResult> ExecuteAsync(
        RevokeAdminCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        return SetAdminRoleAsync(
            command.UserId,
            false,
            AdminModerationOperationStatus.AdminRevoked,
            cancellationToken);
    }

    public async Task<DeleteUserResult> ExecuteAsync(
        DeleteUserCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        var user = await GetUserOrThrowAsync(command.UserId, cancellationToken);

        userRepository.Delete(user);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new DeleteUserResult(user.Id);
    }

    private async Task<AdminModerationResult> SetBlockedStateAsync(
        long userId,
        bool isBlocked,
        AdminModerationOperationStatus status,
        CancellationToken cancellationToken)
    {
        var user = await GetUserOrThrowAsync(userId, cancellationToken);

        var changed = user.IsBlocked != isBlocked;
        if (changed)
        {
            user.IsBlocked = isBlocked;
            user.UpdatedAt = DateTime.UtcNow;
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return new AdminModerationResult(user.Id, status, changed);
    }

    private async Task<AdminModerationResult> SetAdminRoleAsync(
        long userId,
        bool hasAdminRole,
        AdminModerationOperationStatus status,
        CancellationToken cancellationToken)
    {
        var user = await GetUserOrThrowAsync(userId, cancellationToken);

        var changed = await roleService.SetAdminRoleAsync(user, hasAdminRole, cancellationToken);
        if (changed)
        {
            user.UpdatedAt = DateTime.UtcNow;
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return new AdminModerationResult(user.Id, status, changed);
    }

    private async Task<User> GetUserOrThrowAsync(long userId, CancellationToken cancellationToken)
    {
        var user = await userRepository.GetByIdWithRolesAsync(userId, cancellationToken);
        return user ?? throw new AdminUserNotFoundException(userId);
    }
}
