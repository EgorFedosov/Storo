namespace backend.Modules.Users.UseCases.AdminModeration;

public interface IBlockUserUseCase
{
    Task<AdminModerationResult> ExecuteAsync(BlockUserCommand command, CancellationToken cancellationToken);
}
