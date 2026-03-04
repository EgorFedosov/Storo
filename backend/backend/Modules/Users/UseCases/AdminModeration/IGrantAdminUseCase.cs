namespace backend.Modules.Users.UseCases.AdminModeration;

public interface IGrantAdminUseCase
{
    Task<AdminModerationResult> ExecuteAsync(GrantAdminCommand command, CancellationToken cancellationToken);
}
