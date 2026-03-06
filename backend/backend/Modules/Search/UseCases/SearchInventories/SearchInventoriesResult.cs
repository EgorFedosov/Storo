using backend.Modules.Search.UseCases.Shared;

namespace backend.Modules.Search.UseCases.SearchInventories;

public sealed record SearchInventoriesResult(
    IReadOnlyList<SearchInventorySummaryResult> Items,
    int Page,
    int PageSize,
    int TotalCount,
    SearchInventoriesSortResult Sort);

public sealed record SearchInventorySummaryResult(
    long Id,
    string Title,
    string DescriptionMarkdown,
    SearchInventoryCategoryResult Category,
    SearchInventoryCreatorResult Creator,
    IReadOnlyList<SearchInventoryTagResult> Tags,
    string? ImageUrl,
    bool IsPublic,
    int ItemsCount,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record SearchInventoryCategoryResult(int Id, string Name);

public sealed record SearchInventoryCreatorResult(long Id, string UserName, string DisplayName);

public sealed record SearchInventoryTagResult(long Id, string Name);

public sealed record SearchInventoriesSortResult(
    SearchInventoriesSortField Field,
    SearchSortDirection Direction);
