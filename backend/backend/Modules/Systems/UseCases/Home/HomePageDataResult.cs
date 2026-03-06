namespace backend.Modules.Systems.UseCases.Home;

public sealed record HomePageDataResult(
    IReadOnlyList<HomeInventorySummaryResult> LatestInventories,
    IReadOnlyList<HomeInventorySummaryResult> TopPopularInventories,
    IReadOnlyList<HomeTagCloudItemResult> TagCloud);

public sealed record HomeInventorySummaryResult(
    long Id,
    string Title,
    string DescriptionMarkdown,
    string? ImageUrl,
    int ItemsCount,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    HomeInventoryCreatorResult Creator);

public sealed record HomeInventoryCreatorResult(
    long Id,
    string UserName,
    string DisplayName);

public sealed record HomeTagCloudItemResult(
    long Id,
    string Name,
    int Count);
