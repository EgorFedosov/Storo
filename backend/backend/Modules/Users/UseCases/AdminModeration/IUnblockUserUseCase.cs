namespace backend.Modules.Users.UseCases.AdminModeration;

public interface IUnblockUserUseCase
{
    Task<AdminModerationResult> ExecuteAsync(UnblockUserCommand command, CancellationToken cancellationToken);
}
