using backend.Infrastructure.Persistence;
using backend.Modules.Items.Domain;
using backend.Modules.Items.UseCases.Likes;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Items.Infrastructure.Persistence;

public sealed class EfCoreItemLikeRepository(AppDbContext dbContext) : IItemLikeRepository
{
    public Task<bool> ItemExistsAsync(
        long itemId,
        CancellationToken cancellationToken)
    {
        return dbContext.Items
            .AsNoTracking()
            .AnyAsync(item => item.Id == itemId, cancellationToken);
    }

    public Task<bool> HasLikeAsync(
        long itemId,
        long userId,
        CancellationToken cancellationToken)
    {
        return dbContext.ItemLikes
            .AsNoTracking()
            .AnyAsync(like => like.ItemId == itemId && like.UserId == userId, cancellationToken);
    }

    public Task AddLikeAsync(
        ItemLike like,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(like);
        return dbContext.ItemLikes.AddAsync(like, cancellationToken).AsTask();
    }

    public Task<ItemLike?> GetLikeAsync(
        long itemId,
        long userId,
        CancellationToken cancellationToken)
    {
        return dbContext.ItemLikes
            .SingleOrDefaultAsync(
                like => like.ItemId == itemId && like.UserId == userId,
                cancellationToken);
    }

    public void RemoveLike(ItemLike like)
    {
        ArgumentNullException.ThrowIfNull(like);
        dbContext.ItemLikes.Remove(like);
    }

    public Task<ItemLikeStateAggregate?> GetLikeStateAsync(
        long itemId,
        long userId,
        CancellationToken cancellationToken)
    {
        return dbContext.Items
            .AsNoTracking()
            .Where(item => item.Id == itemId)
            .Select(item => new ItemLikeStateAggregate(
                item.Id,
                item.Likes.Count(),
                item.Likes.Any(like => like.UserId == userId)))
            .SingleOrDefaultAsync(cancellationToken);
    }
}
