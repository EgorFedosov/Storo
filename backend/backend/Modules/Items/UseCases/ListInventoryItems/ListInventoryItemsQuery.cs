namespace backend.Modules.Items.UseCases.ListInventoryItems;

public sealed record ListInventoryItemsQuery(
    long InventoryId,
    int Page,
    int PageSize,
    ItemsTableSortField SortField,
    ItemsTableSortDirection SortDirection,
    long? ViewerUserId);
