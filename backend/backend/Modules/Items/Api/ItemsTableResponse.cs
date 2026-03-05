using System.Globalization;
using System.Text.Json.Serialization;
using backend.Modules.Inventories.Domain;
using backend.Modules.Items.UseCases.ListInventoryItems;

namespace backend.Modules.Items.Api;

public sealed record ItemsTableResponse(
    string InventoryId,
    int Version,
    IReadOnlyList<ItemsTableColumnResponse> Columns,
    IReadOnlyList<ItemsTableRowResponse> Rows,
    int Page,
    int PageSize,
    int TotalCount)
{
    public static ItemsTableResponse FromResult(ItemsTableResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new ItemsTableResponse(
            result.InventoryId.ToString(CultureInfo.InvariantCulture),
            result.Version,
            result.Columns.Select(ItemsTableColumnResponse.FromResult).ToArray(),
            result.Rows.Select(ItemsTableRowResponse.FromResult).ToArray(),
            result.Page,
            result.PageSize,
            result.TotalCount);
    }
}

public sealed record ItemsTableColumnResponse(
    string Key,
    string Title,
    string Kind,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? FieldId,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? FieldType)
{
    public static ItemsTableColumnResponse FromResult(ItemsTableColumnResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new ItemsTableColumnResponse(
            result.Key,
            result.Title,
            ToContractKind(result.Kind),
            result.FieldId?.ToString(CultureInfo.InvariantCulture),
            result.FieldType.HasValue ? ToContractFieldType(result.FieldType.Value) : null);
    }

    private static string ToContractKind(ItemsTableColumnKind kind) => kind switch
    {
        ItemsTableColumnKind.Fixed => "fixed",
        ItemsTableColumnKind.Custom => "custom",
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unsupported column kind.")
    };

    private static string ToContractFieldType(CustomFieldType fieldType) => fieldType switch
    {
        CustomFieldType.SingleLine => "single_line",
        CustomFieldType.MultiLine => "multi_line",
        CustomFieldType.Number => "number",
        CustomFieldType.Link => "link",
        CustomFieldType.Bool => "bool",
        _ => throw new ArgumentOutOfRangeException(nameof(fieldType), fieldType, "Unsupported custom field type.")
    };
}

public sealed record ItemsTableRowResponse(
    string ItemId,
    int Version,
    IReadOnlyDictionary<string, object?> Cells,
    ItemLikeStateResponse Like)
{
    public static ItemsTableRowResponse FromResult(ItemsTableRowResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new ItemsTableRowResponse(
            result.ItemId.ToString(CultureInfo.InvariantCulture),
            result.Version,
            result.Cells,
            ItemLikeStateResponse.FromResult(result.Like));
    }
}

public sealed record ItemLikeStateResponse(
    int Count,
    bool LikedByCurrentUser)
{
    public static ItemLikeStateResponse FromResult(ItemLikeStateResult result)
    {
        ArgumentNullException.ThrowIfNull(result);
        return new ItemLikeStateResponse(result.Count, result.LikedByCurrentUser);
    }
}
