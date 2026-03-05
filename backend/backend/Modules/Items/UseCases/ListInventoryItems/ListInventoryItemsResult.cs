using backend.Modules.Inventories.Domain;

namespace backend.Modules.Items.UseCases.ListInventoryItems;

public sealed record ItemsTableResult(
    long InventoryId,
    int Version,
    IReadOnlyList<ItemsTableColumnResult> Columns,
    IReadOnlyList<ItemsTableRowResult> Rows,
    int Page,
    int PageSize,
    int TotalCount);

public sealed record ItemsTableColumnResult(
    string Key,
    string Title,
    ItemsTableColumnKind Kind,
    long? FieldId,
    CustomFieldType? FieldType);

public sealed record ItemsTableRowResult(
    long ItemId,
    int Version,
    IReadOnlyDictionary<string, object?> Cells,
    ItemLikeStateResult Like);

public sealed record ItemLikeStateResult(
    int Count,
    bool LikedByCurrentUser);

public enum ItemsTableColumnKind
{
    Fixed = 1,
    Custom = 2
}

public enum ItemsTableSortDirection
{
    Asc = 1,
    Desc = 2
}

public enum ItemsTableSortFieldKind
{
    CustomId = 1,
    CreatedAt = 2,
    UpdatedAt = 3,
    CustomField = 4
}

public sealed record ItemsTableSortField(ItemsTableSortFieldKind Kind, long? FieldId = null);
