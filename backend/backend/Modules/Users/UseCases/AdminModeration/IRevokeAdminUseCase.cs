namespace backend.Modules.Users.UseCases.AdminModeration;

public interface IRevokeAdminUseCase
{
    Task<AdminModerationResult> ExecuteAsync(RevokeAdminCommand command, CancellationToken cancellationToken);
}
