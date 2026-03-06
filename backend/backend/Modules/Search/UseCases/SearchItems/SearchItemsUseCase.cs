using backend.Modules.Search.UseCases.Abstractions;

namespace backend.Modules.Search.UseCases.SearchItems;

public sealed class SearchItemsUseCase(ISearchReadModel searchReadModel) : ISearchItemsUseCase
{
    public Task<SearchItemsResult> ExecuteAsync(
        SearchItemsQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        return searchReadModel.SearchItemsAsync(query, cancellationToken);
    }
}
