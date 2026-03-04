using backend.Modules.Inventories.Domain;

namespace backend.Modules.Inventories.UseCases.Abstractions;

public interface IDiscussionRepository
{
    Task<bool> InventoryExistsAsync(long inventoryId, CancellationToken cancellationToken);

    Task<IReadOnlyList<DiscussionPostAggregate>> ListPostsAsync(
        DiscussionPostsReadQuery query,
        CancellationToken cancellationToken);

    Task AddPostAsync(DiscussionPost post, CancellationToken cancellationToken);

    Task<DiscussionPostAggregate?> GetPostByIdAsync(long postId, CancellationToken cancellationToken);
}

public sealed record DiscussionPostsReadQuery(
    long InventoryId,
    long? AfterId,
    long? BeforeId,
    int Limit);

public sealed record DiscussionPostAggregate(
    long Id,
    long InventoryId,
    string ContentMarkdown,
    DateTime CreatedAt,
    long AuthorId,
    string AuthorUserName,
    string AuthorDisplayName);
