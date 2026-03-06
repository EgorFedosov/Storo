using backend.Modules.Search.UseCases.AutocompleteTags;
using backend.Modules.Search.UseCases.GetTagCloud;

namespace backend.Modules.Search.UseCases.Abstractions;

public interface ITagReadModel
{
    Task<IReadOnlyList<TagAutocompleteResult>> AutocompleteAsync(
        AutocompleteTagsQuery query,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<TagCloudEntryResult>> GetTagCloudAsync(
        GetTagCloudQuery query,
        CancellationToken cancellationToken);
}
