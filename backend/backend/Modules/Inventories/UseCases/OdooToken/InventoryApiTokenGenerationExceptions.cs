namespace backend.Modules.Inventories.UseCases.OdooToken;

public sealed class InventoryApiTokenGenerationAccessDeniedException(long inventoryId, long actorUserId)
    : Exception($"User '{actorUserId}' does not have permission to generate API token for inventory '{inventoryId}'.")
{
    public long InventoryId { get; } = inventoryId;
    public long ActorUserId { get; } = actorUserId;
}

public sealed class InventoryApiTokenGenerationConflictException(long inventoryId)
    : Exception($"Active API token for inventory '{inventoryId}' was modified concurrently.")
{
    public long InventoryId { get; } = inventoryId;
}
