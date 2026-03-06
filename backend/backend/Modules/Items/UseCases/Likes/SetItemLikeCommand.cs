namespace backend.Modules.Items.UseCases.Likes;

public sealed record SetItemLikeCommand(
    long ItemId,
    long ActorUserId);
