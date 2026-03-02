namespace backend.Modules.Auth.UseCases.CurrentUser;

public interface IGetCurrentUserUseCase
{
    Task<CurrentUserResult> ExecuteAsync(GetCurrentUserQuery query, CancellationToken cancellationToken);
}
