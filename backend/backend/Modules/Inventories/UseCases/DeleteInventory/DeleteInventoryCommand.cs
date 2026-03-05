using backend.Modules.Concurrency.UseCases.Versioning;

namespace backend.Modules.Inventories.UseCases.DeleteInventory;

public sealed record DeleteInventoryCommand(
    long InventoryId,
    long ActorUserId,
    bool ActorIsAdmin,
    IfMatchToken IfMatchToken);
