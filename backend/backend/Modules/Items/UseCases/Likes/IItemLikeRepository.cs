using backend.Modules.Items.Domain;

namespace backend.Modules.Items.UseCases.Likes;

public interface IItemLikeRepository
{
    Task<bool> ItemExistsAsync(
        long itemId,
        CancellationToken cancellationToken);

    Task<bool> HasLikeAsync(
        long itemId,
        long userId,
        CancellationToken cancellationToken);

    Task AddLikeAsync(
        ItemLike like,
        CancellationToken cancellationToken);

    Task<ItemLike?> GetLikeAsync(
        long itemId,
        long userId,
        CancellationToken cancellationToken);

    void RemoveLike(ItemLike like);

    Task<ItemLikeStateAggregate?> GetLikeStateAsync(
        long itemId,
        long userId,
        CancellationToken cancellationToken);
}

public sealed record ItemLikeStateAggregate(
    long ItemId,
    int Count,
    bool LikedByCurrentUser);
