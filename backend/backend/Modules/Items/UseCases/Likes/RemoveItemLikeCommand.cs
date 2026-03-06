namespace backend.Modules.Items.UseCases.Likes;

public sealed record RemoveItemLikeCommand(
    long ItemId,
    long ActorUserId);
