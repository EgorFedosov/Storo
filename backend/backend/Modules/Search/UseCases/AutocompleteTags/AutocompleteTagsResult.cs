namespace backend.Modules.Search.UseCases.AutocompleteTags;

public sealed record TagAutocompleteResult(long Id, string Name);

public sealed record AutocompleteTagsResult(IReadOnlyList<TagAutocompleteResult> Items);
