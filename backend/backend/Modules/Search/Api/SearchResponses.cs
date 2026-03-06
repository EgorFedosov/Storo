using System.Globalization;
using backend.Modules.Search.UseCases.SearchInventories;
using backend.Modules.Search.UseCases.SearchItems;
using backend.Modules.Search.UseCases.Shared;

namespace backend.Modules.Search.Api;

public sealed record SearchInventoriesResponse(
    IReadOnlyList<SearchInventorySummaryResponse> Items,
    int Page,
    int PageSize,
    int TotalCount,
    SearchInventoriesSortResponse Sort)
{
    public static SearchInventoriesResponse FromResult(SearchInventoriesResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new SearchInventoriesResponse(
            result.Items.Select(SearchInventorySummaryResponse.FromResult).ToArray(),
            result.Page,
            result.PageSize,
            result.TotalCount,
            SearchInventoriesSortResponse.FromResult(result.Sort));
    }
}

public sealed record SearchInventorySummaryResponse(
    string Id,
    string Title,
    string DescriptionMarkdown,
    SearchInventoryCategoryResponse Category,
    SearchInventoryCreatorResponse Creator,
    IReadOnlyList<SearchInventoryTagResponse> Tags,
    string? ImageUrl,
    bool IsPublic,
    int ItemsCount,
    DateTime CreatedAt,
    DateTime UpdatedAt)
{
    public static SearchInventorySummaryResponse FromResult(SearchInventorySummaryResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new SearchInventorySummaryResponse(
            result.Id.ToString(CultureInfo.InvariantCulture),
            result.Title,
            result.DescriptionMarkdown,
            new SearchInventoryCategoryResponse(result.Category.Id, result.Category.Name),
            new SearchInventoryCreatorResponse(
                result.Creator.Id.ToString(CultureInfo.InvariantCulture),
                result.Creator.UserName,
                result.Creator.DisplayName),
            result.Tags.Select(SearchInventoryTagResponse.FromResult).ToArray(),
            result.ImageUrl,
            result.IsPublic,
            result.ItemsCount,
            result.CreatedAt,
            result.UpdatedAt);
    }
}

public sealed record SearchInventoryCategoryResponse(int Id, string Name);

public sealed record SearchInventoryCreatorResponse(string Id, string UserName, string DisplayName);

public sealed record SearchInventoryTagResponse(string Id, string Name)
{
    public static SearchInventoryTagResponse FromResult(SearchInventoryTagResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new SearchInventoryTagResponse(
            result.Id.ToString(CultureInfo.InvariantCulture),
            result.Name);
    }
}

public sealed record SearchInventoriesSortResponse(string Field, string Direction)
{
    public static SearchInventoriesSortResponse FromResult(SearchInventoriesSortResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new SearchInventoriesSortResponse(
            ToContractField(result.Field),
            ToContractDirection(result.Direction));
    }

    private static string ToContractField(SearchInventoriesSortField field) => field switch
    {
        SearchInventoriesSortField.Relevance => "relevance",
        SearchInventoriesSortField.UpdatedAt => "updatedAt",
        SearchInventoriesSortField.CreatedAt => "createdAt",
        SearchInventoriesSortField.Title => "title",
        _ => throw new ArgumentOutOfRangeException(nameof(field), field, "Unsupported sort field.")
    };

    private static string ToContractDirection(SearchSortDirection direction) => direction switch
    {
        SearchSortDirection.Asc => "asc",
        SearchSortDirection.Desc => "desc",
        _ => throw new ArgumentOutOfRangeException(nameof(direction), direction, "Unsupported sort direction.")
    };
}

public sealed record SearchItemsResponse(
    IReadOnlyList<SearchItemSummaryResponse> Items,
    int Page,
    int PageSize,
    int TotalCount,
    SearchItemsSortResponse Sort)
{
    public static SearchItemsResponse FromResult(SearchItemsResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new SearchItemsResponse(
            result.Items.Select(SearchItemSummaryResponse.FromResult).ToArray(),
            result.Page,
            result.PageSize,
            result.TotalCount,
            SearchItemsSortResponse.FromResult(result.Sort));
    }
}

public sealed record SearchItemSummaryResponse(
    string Id,
    string CustomId,
    SearchItemInventoryResponse Inventory,
    DateTime CreatedAt,
    DateTime UpdatedAt)
{
    public static SearchItemSummaryResponse FromResult(SearchItemSummaryResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new SearchItemSummaryResponse(
            result.Id.ToString(CultureInfo.InvariantCulture),
            result.CustomId,
            new SearchItemInventoryResponse(
                result.Inventory.Id.ToString(CultureInfo.InvariantCulture),
                result.Inventory.Title),
            result.CreatedAt,
            result.UpdatedAt);
    }
}

public sealed record SearchItemInventoryResponse(string Id, string Title);

public sealed record SearchItemsSortResponse(string Field, string Direction)
{
    public static SearchItemsSortResponse FromResult(SearchItemsSortResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new SearchItemsSortResponse(
            ToContractField(result.Field),
            ToContractDirection(result.Direction));
    }

    private static string ToContractField(SearchItemsSortField field) => field switch
    {
        SearchItemsSortField.Relevance => "relevance",
        SearchItemsSortField.UpdatedAt => "updatedAt",
        SearchItemsSortField.CreatedAt => "createdAt",
        SearchItemsSortField.CustomId => "customId",
        _ => throw new ArgumentOutOfRangeException(nameof(field), field, "Unsupported sort field.")
    };

    private static string ToContractDirection(SearchSortDirection direction) => direction switch
    {
        SearchSortDirection.Asc => "asc",
        SearchSortDirection.Desc => "desc",
        _ => throw new ArgumentOutOfRangeException(nameof(direction), direction, "Unsupported sort direction.")
    };
}
