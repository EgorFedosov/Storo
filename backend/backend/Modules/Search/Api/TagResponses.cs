using System.Globalization;
using backend.Modules.Search.UseCases.AutocompleteTags;
using backend.Modules.Search.UseCases.GetTagCloud;

namespace backend.Modules.Search.Api;

public sealed record TagAutocompleteResponse(IReadOnlyList<TagAutocompleteItemResponse> Items)
{
    public static TagAutocompleteResponse FromResult(AutocompleteTagsResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new TagAutocompleteResponse(
            result.Items.Select(TagAutocompleteItemResponse.FromResult).ToArray());
    }
}

public sealed record TagAutocompleteItemResponse(string Id, string Name)
{
    public static TagAutocompleteItemResponse FromResult(TagAutocompleteResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new TagAutocompleteItemResponse(
            result.Id.ToString(CultureInfo.InvariantCulture),
            result.Name);
    }
}

public sealed record TagCloudResponse(IReadOnlyList<TagCloudItemResponse> Items)
{
    public static TagCloudResponse FromResult(TagCloudResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new TagCloudResponse(
            result.Items.Select(TagCloudItemResponse.FromResult).ToArray());
    }
}

public sealed record TagCloudItemResponse(string Id, string Name, int Count)
{
    public static TagCloudItemResponse FromResult(TagCloudEntryResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new TagCloudItemResponse(
            result.Id.ToString(CultureInfo.InvariantCulture),
            result.Name,
            result.Count);
    }
}
