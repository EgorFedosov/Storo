namespace backend.Modules.Users.UseCases.ListUsersForAdmin;

public interface IAdminUsersReadRepository
{
    Task<AdminUsersPageResult> ListAsync(
        AdminUsersReadRepositoryQuery query,
        CancellationToken cancellationToken);
}

public sealed record AdminUsersReadRepositoryQuery(
    bool? IsBlocked,
    AdminUsersRoleFilter RoleFilter,
    string? SearchQuery,
    int Page,
    int PageSize,
    AdminUsersSortField SortField,
    AdminUsersSortDirection SortDirection);
