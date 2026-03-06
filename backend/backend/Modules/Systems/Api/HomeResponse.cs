using System.Globalization;
using backend.Modules.Systems.UseCases.Home;

namespace backend.Modules.Systems.Api;

public sealed record HomeResponse(
    IReadOnlyList<HomeInventorySummaryResponse> LatestInventories,
    IReadOnlyList<HomeInventorySummaryResponse> TopPopularInventories,
    IReadOnlyList<HomeTagCloudItemResponse> TagCloud)
{
    public static HomeResponse FromResult(HomePageDataResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new HomeResponse(
            result.LatestInventories.Select(HomeInventorySummaryResponse.FromResult).ToArray(),
            result.TopPopularInventories.Select(HomeInventorySummaryResponse.FromResult).ToArray(),
            result.TagCloud.Select(HomeTagCloudItemResponse.FromResult).ToArray());
    }
}

public sealed record HomeInventorySummaryResponse(
    string Id,
    string Title,
    string DescriptionMarkdown,
    string? ImageUrl,
    int ItemsCount,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    HomeInventoryCreatorResponse Creator)
{
    public static HomeInventorySummaryResponse FromResult(HomeInventorySummaryResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new HomeInventorySummaryResponse(
            result.Id.ToString(CultureInfo.InvariantCulture),
            result.Title,
            result.DescriptionMarkdown,
            result.ImageUrl,
            result.ItemsCount,
            result.CreatedAt,
            result.UpdatedAt,
            new HomeInventoryCreatorResponse(
                result.Creator.Id.ToString(CultureInfo.InvariantCulture),
                result.Creator.UserName,
                result.Creator.DisplayName));
    }
}

public sealed record HomeInventoryCreatorResponse(
    string Id,
    string UserName,
    string DisplayName);

public sealed record HomeTagCloudItemResponse(
    string Id,
    string Name,
    int Count)
{
    public static HomeTagCloudItemResponse FromResult(HomeTagCloudItemResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new HomeTagCloudItemResponse(
            result.Id.ToString(CultureInfo.InvariantCulture),
            result.Name,
            result.Count);
    }
}
