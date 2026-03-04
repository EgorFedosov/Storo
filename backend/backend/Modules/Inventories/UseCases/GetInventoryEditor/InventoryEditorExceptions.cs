namespace backend.Modules.Inventories.UseCases.GetInventoryEditor;

public sealed class InventoryEditorAccessDeniedException(long inventoryId, long viewerUserId)
    : Exception($"User '{viewerUserId}' does not have editor access to inventory '{inventoryId}'.")
{
    public long InventoryId { get; } = inventoryId;
    public long ViewerUserId { get; } = viewerUserId;
}
