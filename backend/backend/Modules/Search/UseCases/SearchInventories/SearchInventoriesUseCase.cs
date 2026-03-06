using backend.Modules.Search.UseCases.Abstractions;

namespace backend.Modules.Search.UseCases.SearchInventories;

public sealed class SearchInventoriesUseCase(ISearchReadModel searchReadModel) : ISearchInventoriesUseCase
{
    public Task<SearchInventoriesResult> ExecuteAsync(
        SearchInventoriesQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        return searchReadModel.SearchInventoriesAsync(query, cancellationToken);
    }
}
