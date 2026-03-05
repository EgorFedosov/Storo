namespace backend.Modules.Inventories.UseCases.CustomIdTemplate;

public sealed class InventoryCustomIdTemplateAccessDeniedException(long inventoryId, long actorUserId)
    : Exception($"User '{actorUserId}' does not have write access to inventory '{inventoryId}'.")
{
    public long InventoryId { get; } = inventoryId;
    public long ActorUserId { get; } = actorUserId;
}
