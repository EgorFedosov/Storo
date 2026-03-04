namespace backend.Modules.Inventories.UseCases.Discussion;

public sealed record DiscussionPostsPageResult(
    long InventoryId,
    IReadOnlyList<DiscussionPostResult> Posts,
    bool HasMore);

public sealed record DiscussionPostResult(
    long Id,
    long InventoryId,
    string ContentMarkdown,
    DateTime CreatedAt,
    DiscussionPostAuthorResult Author);

public sealed record DiscussionPostAuthorResult(
    long Id,
    string UserName,
    string DisplayName);

public sealed record DiscussionPostedEvent(
    string Event,
    long InventoryId,
    DiscussionPostResult Post)
{
    public const string PostedEventName = "discussion.posted";

    public static DiscussionPostedEvent Create(DiscussionPostResult post)
    {
        ArgumentNullException.ThrowIfNull(post);
        return new DiscussionPostedEvent(PostedEventName, post.InventoryId, post);
    }
}
