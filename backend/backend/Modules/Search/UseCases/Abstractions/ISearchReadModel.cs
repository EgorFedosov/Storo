using backend.Modules.Search.UseCases.SearchInventories;
using backend.Modules.Search.UseCases.SearchItems;

namespace backend.Modules.Search.UseCases.Abstractions;

public interface ISearchReadModel
{
    Task<SearchInventoriesResult> SearchInventoriesAsync(
        SearchInventoriesQuery query,
        CancellationToken cancellationToken);

    Task<SearchItemsResult> SearchItemsAsync(
        SearchItemsQuery query,
        CancellationToken cancellationToken);
}
