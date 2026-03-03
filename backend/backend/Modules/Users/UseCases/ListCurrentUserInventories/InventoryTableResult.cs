namespace backend.Modules.Users.UseCases.ListCurrentUserInventories;

public sealed record InventoryTableResult(
    InventoryRelation Relation,
    IReadOnlyList<InventoryTableRowResult> Items,
    int Page,
    int PageSize,
    int TotalCount,
    InventoryTableSortResult Sort);

public sealed record InventoryTableRowResult(
    long Id,
    string Title,
    int CategoryId,
    string CategoryName,
    long OwnerId,
    string OwnerUserName,
    string OwnerDisplayName,
    bool IsPublic,
    int ItemsCount,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record InventoryTableSortResult(
    InventoryTableSortField Field,
    InventoryTableSortDirection Direction);
