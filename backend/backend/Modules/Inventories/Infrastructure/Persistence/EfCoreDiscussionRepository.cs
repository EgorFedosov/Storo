using backend.Infrastructure.Persistence;
using backend.Modules.Inventories.Domain;
using backend.Modules.Inventories.UseCases.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Inventories.Infrastructure.Persistence;

public sealed class EfCoreDiscussionRepository(AppDbContext dbContext) : IDiscussionRepository
{
    public Task<bool> InventoryExistsAsync(long inventoryId, CancellationToken cancellationToken)
    {
        return dbContext.Inventories
            .AsNoTracking()
            .AnyAsync(inventory => inventory.Id == inventoryId, cancellationToken);
    }

    public async Task<IReadOnlyList<DiscussionPostAggregate>> ListPostsAsync(
        DiscussionPostsReadQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var postsQuery = dbContext.DiscussionPosts
            .AsNoTracking()
            .Where(post => post.InventoryId == query.InventoryId);

        if (query.AfterId.HasValue)
        {
            postsQuery = postsQuery
                .Where(post => post.Id > query.AfterId.Value)
                .OrderBy(post => post.Id);
        }
        else
        {
            if (query.BeforeId.HasValue)
            {
                postsQuery = postsQuery.Where(post => post.Id < query.BeforeId.Value);
            }

            postsQuery = postsQuery.OrderByDescending(post => post.Id);
        }

        var result = await postsQuery
            .Take(query.Limit)
            .Select(post => new DiscussionPostAggregate(
                post.Id,
                post.InventoryId,
                post.ContentMarkdown,
                post.CreatedAt,
                post.AuthorUserId,
                post.AuthorUser.UserName,
                post.AuthorUser.DisplayName))
            .ToListAsync(cancellationToken);

        if (!query.AfterId.HasValue)
        {
            result.Reverse();
        }

        return result;
    }

    public Task AddPostAsync(DiscussionPost post, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(post);
        return dbContext.DiscussionPosts.AddAsync(post, cancellationToken).AsTask();
    }

    public Task<DiscussionPostAggregate?> GetPostByIdAsync(long postId, CancellationToken cancellationToken)
    {
        return dbContext.DiscussionPosts
            .AsNoTracking()
            .Where(post => post.Id == postId)
            .Select(post => new DiscussionPostAggregate(
                post.Id,
                post.InventoryId,
                post.ContentMarkdown,
                post.CreatedAt,
                post.AuthorUserId,
                post.AuthorUser.UserName,
                post.AuthorUser.DisplayName))
            .SingleOrDefaultAsync(cancellationToken);
    }
}
