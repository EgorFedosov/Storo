using System.Globalization;
using backend.Modules.Users.UseCases.ListUsersForAdmin;

namespace backend.Modules.Users.Api;

public sealed record AdminUsersPageResponse(
    IReadOnlyList<AdminUserListItemResponse> Items,
    int Page,
    int PageSize,
    int TotalCount,
    AdminUsersSortResponse Sort)
{
    public static AdminUsersPageResponse FromResult(AdminUsersPageResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new AdminUsersPageResponse(
            result.Items.Select(AdminUserListItemResponse.FromResult).ToArray(),
            result.Page,
            result.PageSize,
            result.TotalCount,
            AdminUsersSortResponse.FromResult(result.Sort));
    }
}

public sealed record AdminUserListItemResponse(
    string Id,
    string Email,
    string UserName,
    string DisplayName,
    bool IsBlocked,
    IReadOnlyCollection<string> Roles,
    DateTime CreatedAt,
    DateTime UpdatedAt)
{
    public static AdminUserListItemResponse FromResult(AdminUserListItemResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new AdminUserListItemResponse(
            result.Id.ToString(CultureInfo.InvariantCulture),
            result.Email,
            result.UserName,
            result.DisplayName,
            result.IsBlocked,
            result.Roles,
            result.CreatedAt,
            result.UpdatedAt);
    }
}

public sealed record AdminUsersSortResponse(string Field, string Direction)
{
    public static AdminUsersSortResponse FromResult(AdminUsersSortResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new AdminUsersSortResponse(
            ToContractField(result.Field),
            ToContractDirection(result.Direction));
    }

    private static string ToContractField(AdminUsersSortField field) => field switch
    {
        AdminUsersSortField.UpdatedAt => "updatedAt",
        AdminUsersSortField.CreatedAt => "createdAt",
        AdminUsersSortField.UserName => "userName",
        AdminUsersSortField.Email => "email",
        _ => throw new ArgumentOutOfRangeException(nameof(field), field, "Unsupported sort field.")
    };

    private static string ToContractDirection(AdminUsersSortDirection direction) => direction switch
    {
        AdminUsersSortDirection.Asc => "asc",
        AdminUsersSortDirection.Desc => "desc",
        _ => throw new ArgumentOutOfRangeException(nameof(direction), direction, "Unsupported sort direction.")
    };
}
