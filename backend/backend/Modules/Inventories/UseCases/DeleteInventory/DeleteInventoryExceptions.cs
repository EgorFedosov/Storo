namespace backend.Modules.Inventories.UseCases.DeleteInventory;

public sealed class InventoryDeleteAccessDeniedException(long inventoryId, long actorUserId)
    : Exception($"User '{actorUserId}' does not have permission to delete inventory '{inventoryId}'.")
{
    public long InventoryId { get; } = inventoryId;
    public long ActorUserId { get; } = actorUserId;
}
