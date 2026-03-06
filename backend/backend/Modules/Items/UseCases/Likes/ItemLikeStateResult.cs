namespace backend.Modules.Items.UseCases.Likes;

public sealed record ItemLikeStateResult(
    long ItemId,
    int Count,
    bool LikedByCurrentUser);
