namespace backend.Modules.Search.UseCases.SearchItems;

public interface ISearchItemsUseCase
{
    Task<SearchItemsResult> ExecuteAsync(
        SearchItemsQuery query,
        CancellationToken cancellationToken);
}
