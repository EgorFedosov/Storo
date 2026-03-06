namespace backend.Modules.Search.UseCases.AutocompleteTags;

public sealed record AutocompleteTagsQuery(string Prefix, int Limit);
