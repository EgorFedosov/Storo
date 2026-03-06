using backend.Modules.Search.UseCases.Abstractions;

namespace backend.Modules.Search.UseCases.AutocompleteTags;

public sealed class AutocompleteTagsUseCase(ITagReadModel tagReadModel) : IAutocompleteTagsUseCase
{
    public async Task<AutocompleteTagsResult> ExecuteAsync(
        AutocompleteTagsQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var items = await tagReadModel.AutocompleteAsync(query, cancellationToken);
        return new AutocompleteTagsResult(items);
    }
}
