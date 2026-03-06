using backend.Modules.Search.UseCases.Shared;

namespace backend.Modules.Search.UseCases.SearchItems;

public sealed record SearchItemsResult(
    IReadOnlyList<SearchItemSummaryResult> Items,
    int Page,
    int PageSize,
    int TotalCount,
    SearchItemsSortResult Sort);

public sealed record SearchItemSummaryResult(
    long Id,
    string CustomId,
    SearchItemInventoryResult Inventory,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record SearchItemInventoryResult(long Id, string Title);

public sealed record SearchItemsSortResult(
    SearchItemsSortField Field,
    SearchSortDirection Direction);
