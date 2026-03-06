using System.Globalization;

namespace backend.Modules.Items.UseCases.ItemLifecycle;

public sealed class ItemNotFoundException(long itemId)
    : Exception($"Item '{itemId.ToString(CultureInfo.InvariantCulture)}' was not found.")
{
    public long ItemId { get; } = itemId;
}

public sealed class ItemWriteAccessDeniedException(long itemId, long inventoryId, long actorUserId)
    : Exception(
        $"User '{actorUserId.ToString(CultureInfo.InvariantCulture)}' does not have write access to item '{itemId.ToString(CultureInfo.InvariantCulture)}' in inventory '{inventoryId.ToString(CultureInfo.InvariantCulture)}'.")
{
    public long ItemId { get; } = itemId;
    public long InventoryId { get; } = inventoryId;
    public long ActorUserId { get; } = actorUserId;
}
