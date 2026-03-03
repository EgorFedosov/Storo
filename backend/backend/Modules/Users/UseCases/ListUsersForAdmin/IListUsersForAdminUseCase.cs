namespace backend.Modules.Users.UseCases.ListUsersForAdmin;

public interface IListUsersForAdminUseCase
{
    Task<AdminUsersPageResult> ExecuteAsync(ListUsersForAdminQuery query, CancellationToken cancellationToken);
}
