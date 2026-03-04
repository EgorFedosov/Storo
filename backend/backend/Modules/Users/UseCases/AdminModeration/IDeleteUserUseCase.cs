namespace backend.Modules.Users.UseCases.AdminModeration;

public interface IDeleteUserUseCase
{
    Task<DeleteUserResult> ExecuteAsync(DeleteUserCommand command, CancellationToken cancellationToken);
}
