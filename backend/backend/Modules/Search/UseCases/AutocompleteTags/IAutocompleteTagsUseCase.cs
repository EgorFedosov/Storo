namespace backend.Modules.Search.UseCases.AutocompleteTags;

public interface IAutocompleteTagsUseCase
{
    Task<AutocompleteTagsResult> ExecuteAsync(
        AutocompleteTagsQuery query,
        CancellationToken cancellationToken);
}
