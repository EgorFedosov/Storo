using backend.Modules.Search.UseCases.Shared;

namespace backend.Modules.Search.UseCases.SearchItems;

public sealed record SearchItemsQuery(
    string Query,
    int Page,
    int PageSize,
    SearchItemsSortField SortField,
    SearchSortDirection SortDirection);

public enum SearchItemsSortField
{
    Relevance = 1,
    UpdatedAt = 2,
    CreatedAt = 3,
    CustomId = 4
}
