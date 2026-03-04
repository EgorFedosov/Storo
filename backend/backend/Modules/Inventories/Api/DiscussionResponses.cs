using System.Globalization;
using backend.Modules.Inventories.UseCases.Discussion;

namespace backend.Modules.Inventories.Api;

public sealed record DiscussionPostsResponse(
    string InventoryId,
    IReadOnlyList<DiscussionPostResponse> Posts,
    bool HasMore)
{
    public static DiscussionPostsResponse FromResult(DiscussionPostsPageResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new DiscussionPostsResponse(
            result.InventoryId.ToString(CultureInfo.InvariantCulture),
            result.Posts.Select(DiscussionPostResponse.FromResult).ToArray(),
            result.HasMore);
    }
}

public sealed record DiscussionPostResponse(
    string Id,
    string ContentMarkdown,
    DateTime CreatedAt,
    DiscussionPostAuthorResponse Author)
{
    public static DiscussionPostResponse FromResult(DiscussionPostResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new DiscussionPostResponse(
            result.Id.ToString(CultureInfo.InvariantCulture),
            result.ContentMarkdown,
            result.CreatedAt,
            new DiscussionPostAuthorResponse(
                result.Author.Id.ToString(CultureInfo.InvariantCulture),
                result.Author.UserName,
                result.Author.DisplayName));
    }
}

public sealed record DiscussionPostAuthorResponse(
    string Id,
    string UserName,
    string DisplayName);
