using backend.Modules.Search.UseCases.Shared;

namespace backend.Modules.Search.UseCases.SearchInventories;

public sealed record SearchInventoriesQuery(
    string? Query,
    string? Tag,
    int Page,
    int PageSize,
    SearchInventoriesSortField SortField,
    SearchSortDirection SortDirection);

public enum SearchInventoriesSortField
{
    Relevance = 1,
    UpdatedAt = 2,
    CreatedAt = 3,
    Title = 4
}
