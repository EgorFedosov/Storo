namespace backend.Modules.Users.UseCases.ListUsersForAdmin;

public sealed record AdminUsersPageResult(
    IReadOnlyList<AdminUserListItemResult> Items,
    int Page,
    int PageSize,
    int TotalCount,
    AdminUsersSortResult Sort);

public sealed record AdminUserListItemResult(
    long Id,
    string Email,
    string UserName,
    string DisplayName,
    bool IsBlocked,
    IReadOnlyCollection<string> Roles,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record AdminUsersSortResult(
    AdminUsersSortField Field,
    AdminUsersSortDirection Direction);
