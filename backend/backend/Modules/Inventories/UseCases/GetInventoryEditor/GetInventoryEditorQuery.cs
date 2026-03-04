namespace backend.Modules.Inventories.UseCases.GetInventoryEditor;

public sealed record GetInventoryEditorQuery(
    long InventoryId,
    long ViewerUserId,
    bool ViewerIsAdmin);
