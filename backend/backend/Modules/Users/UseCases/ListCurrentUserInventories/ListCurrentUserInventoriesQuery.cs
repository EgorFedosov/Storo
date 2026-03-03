namespace backend.Modules.Users.UseCases.ListCurrentUserInventories;

public sealed record ListCurrentUserInventoriesQuery(
    InventoryRelation Relation,
    string? SearchQuery,
    int Page,
    int PageSize,
    InventoryTableSortField SortField,
    InventoryTableSortDirection SortDirection);

public enum InventoryRelation
{
    Owned = 0,
    Writable = 1
}

public enum InventoryTableSortField
{
    UpdatedAt = 0,
    CreatedAt = 1,
    Title = 2,
    ItemsCount = 3
}

public enum InventoryTableSortDirection
{
    Desc = 0,
    Asc = 1
}
