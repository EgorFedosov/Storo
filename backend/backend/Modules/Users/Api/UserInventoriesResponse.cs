using System.Globalization;
using backend.Modules.Users.UseCases.ListCurrentUserInventories;

namespace backend.Modules.Users.Api;

public sealed record UserInventoriesResponse(
    string Relation,
    IReadOnlyList<UserInventoryRowResponse> Items,
    int Page,
    int PageSize,
    int TotalCount,
    UserInventoriesSortResponse Sort)
{
    public static UserInventoriesResponse FromResult(InventoryTableResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new UserInventoriesResponse(
            ToContractRelation(result.Relation),
            result.Items.Select(UserInventoryRowResponse.FromResult).ToArray(),
            result.Page,
            result.PageSize,
            result.TotalCount,
            UserInventoriesSortResponse.FromResult(result.Sort));
    }

    private static string ToContractRelation(InventoryRelation relation) => relation switch
    {
        InventoryRelation.Owned => "owned",
        InventoryRelation.Writable => "writable",
        _ => throw new ArgumentOutOfRangeException(nameof(relation), relation, "Unsupported relation value.")
    };
}

public sealed record UserInventoryRowResponse(
    string Id,
    string Title,
    UserInventoryCategoryResponse Category,
    UserInventoryOwnerResponse Owner,
    bool IsPublic,
    int ItemsCount,
    DateTime CreatedAt,
    DateTime UpdatedAt)
{
    public static UserInventoryRowResponse FromResult(InventoryTableRowResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new UserInventoryRowResponse(
            result.Id.ToString(CultureInfo.InvariantCulture),
            result.Title,
            new UserInventoryCategoryResponse(result.CategoryId, result.CategoryName),
            new UserInventoryOwnerResponse(
                result.OwnerId.ToString(CultureInfo.InvariantCulture),
                result.OwnerUserName,
                result.OwnerDisplayName),
            result.IsPublic,
            result.ItemsCount,
            result.CreatedAt,
            result.UpdatedAt);
    }
}

public sealed record UserInventoryCategoryResponse(int Id, string Name);

public sealed record UserInventoryOwnerResponse(string Id, string UserName, string DisplayName);

public sealed record UserInventoriesSortResponse(string Field, string Direction)
{
    public static UserInventoriesSortResponse FromResult(InventoryTableSortResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new UserInventoriesSortResponse(
            ToContractField(result.Field),
            ToContractDirection(result.Direction));
    }

    private static string ToContractField(InventoryTableSortField field) => field switch
    {
        InventoryTableSortField.UpdatedAt => "updatedAt",
        InventoryTableSortField.CreatedAt => "createdAt",
        InventoryTableSortField.Title => "title",
        InventoryTableSortField.ItemsCount => "itemsCount",
        _ => throw new ArgumentOutOfRangeException(nameof(field), field, "Unsupported sort field.")
    };

    private static string ToContractDirection(InventoryTableSortDirection direction) => direction switch
    {
        InventoryTableSortDirection.Asc => "asc",
        InventoryTableSortDirection.Desc => "desc",
        _ => throw new ArgumentOutOfRangeException(nameof(direction), direction, "Unsupported sort direction.")
    };
}
