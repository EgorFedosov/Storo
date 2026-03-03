namespace backend.Modules.Users.UseCases.ListUsersForAdmin;

public sealed record ListUsersForAdminQuery(
    bool? IsBlocked,
    AdminUsersRoleFilter RoleFilter,
    string? SearchQuery,
    int Page,
    int PageSize,
    AdminUsersSortField SortField,
    AdminUsersSortDirection SortDirection);

public enum AdminUsersRoleFilter
{
    All = 0,
    Admin = 1,
    User = 2
}

public enum AdminUsersSortField
{
    UpdatedAt = 0,
    CreatedAt = 1,
    UserName = 2,
    Email = 3
}

public enum AdminUsersSortDirection
{
    Desc = 0,
    Asc = 1
}
