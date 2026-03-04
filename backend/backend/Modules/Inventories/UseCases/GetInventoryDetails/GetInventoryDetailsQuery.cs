namespace backend.Modules.Inventories.UseCases.GetInventoryDetails;

public sealed record GetInventoryDetailsQuery(long InventoryId, InventoryViewerContext ViewerContext);
