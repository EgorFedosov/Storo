namespace backend.Modules.Items.UseCases.ListInventoryItems;

public interface IItemsTableReadModel
{
    Task<ItemsTableResult?> ListAsync(
        ListInventoryItemsReadModelQuery query,
        CancellationToken cancellationToken);
}

public sealed record ListInventoryItemsReadModelQuery(
    long InventoryId,
    int Page,
    int PageSize,
    ItemsTableSortField SortField,
    ItemsTableSortDirection SortDirection,
    long? ViewerUserId);
