using backend.Modules.Auth.UseCases.Authorization;

namespace backend.Modules.Users.UseCases.ListCurrentUserInventories;

public sealed class ListCurrentUserInventoriesUseCase(
    ICurrentUserAccessor currentUserAccessor,
    IUserInventoryReadModel userInventoryReadModel) : IListCurrentUserInventoriesUseCase
{
    private const string AdminRoleName = "admin";

    public async Task<InventoryTableResult> ExecuteAsync(
        ListCurrentUserInventoriesQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var currentUser = currentUserAccessor.CurrentUser;
        if (!currentUser.IsAuthenticated || currentUser.UserId is null)
        {
            return new InventoryTableResult(
                query.Relation,
                Array.Empty<InventoryTableRowResult>(),
                query.Page,
                query.PageSize,
                0,
                new InventoryTableSortResult(query.SortField, query.SortDirection));
        }

        var readModelQuery = new CurrentUserInventoriesReadModelQuery(
            currentUser.UserId.Value,
            IsAdmin(currentUser),
            query.Relation,
            NormalizeSearchQuery(query.SearchQuery),
            query.Page,
            query.PageSize,
            query.SortField,
            query.SortDirection);

        return await userInventoryReadModel.ListCurrentUserInventoriesAsync(readModelQuery, cancellationToken);
    }

    private static bool IsAdmin(CurrentUser currentUser)
    {
        return currentUser.Roles.Any(
            role => string.Equals(role, AdminRoleName, StringComparison.OrdinalIgnoreCase));
    }

    private static string? NormalizeSearchQuery(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
    }
}
