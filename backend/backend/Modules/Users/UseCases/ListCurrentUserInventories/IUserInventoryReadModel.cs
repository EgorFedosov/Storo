namespace backend.Modules.Users.UseCases.ListCurrentUserInventories;

public interface IUserInventoryReadModel
{
    Task<InventoryTableResult> ListCurrentUserInventoriesAsync(
        CurrentUserInventoriesReadModelQuery query,
        CancellationToken cancellationToken);
}

public sealed record CurrentUserInventoriesReadModelQuery(
    long UserId,
    bool IsAdmin,
    InventoryRelation Relation,
    string? SearchQuery,
    int Page,
    int PageSize,
    InventoryTableSortField SortField,
    InventoryTableSortDirection SortDirection);
