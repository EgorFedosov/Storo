namespace backend.Modules.Search.UseCases.SearchInventories;

public interface ISearchInventoriesUseCase
{
    Task<SearchInventoriesResult> ExecuteAsync(
        SearchInventoriesQuery query,
        CancellationToken cancellationToken);
}
