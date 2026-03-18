namespace backend.Modules.Inventories.UseCases.OdooToken;

public sealed record GenerateInventoryApiTokenCommand(
    long InventoryId,
    long ActorUserId,
    bool ActorIsAdmin);
