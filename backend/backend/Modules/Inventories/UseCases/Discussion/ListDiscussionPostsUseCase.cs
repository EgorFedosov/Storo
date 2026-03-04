using backend.Modules.Inventories.UseCases.Abstractions;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;

namespace backend.Modules.Inventories.UseCases.Discussion;

public sealed class ListDiscussionPostsUseCase(IDiscussionRepository discussionRepository) : IListDiscussionPostsUseCase
{
    public async Task<DiscussionPostsPageResult> ExecuteAsync(
        ListDiscussionPostsQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        if (!await discussionRepository.InventoryExistsAsync(query.InventoryId, cancellationToken))
        {
            throw new InventoryNotFoundException(query.InventoryId);
        }

        var readQuery = new DiscussionPostsReadQuery(
            query.InventoryId,
            query.AfterId,
            query.BeforeId,
            checked(query.Limit + 1));

        var aggregates = await discussionRepository.ListPostsAsync(readQuery, cancellationToken);
        var hasMore = aggregates.Count > query.Limit;

        var pagePosts = (hasMore ? aggregates.Take(query.Limit) : aggregates)
            .Select(MapPost)
            .ToArray();

        return new DiscussionPostsPageResult(query.InventoryId, pagePosts, hasMore);
    }

    private static DiscussionPostResult MapPost(DiscussionPostAggregate aggregate)
    {
        ArgumentNullException.ThrowIfNull(aggregate);

        return new DiscussionPostResult(
            aggregate.Id,
            aggregate.InventoryId,
            aggregate.ContentMarkdown,
            aggregate.CreatedAt,
            new DiscussionPostAuthorResult(
                aggregate.AuthorId,
                aggregate.AuthorUserName,
                aggregate.AuthorDisplayName));
    }
}
