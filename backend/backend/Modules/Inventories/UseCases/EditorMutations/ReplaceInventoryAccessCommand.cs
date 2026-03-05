using backend.Modules.Concurrency.UseCases.Versioning;

namespace backend.Modules.Inventories.UseCases.EditorMutations;

public sealed record ReplaceInventoryAccessCommand(
    long InventoryId,
    long ActorUserId,
    bool ActorIsAdmin,
    IfMatchToken IfMatchToken,
    InventoryAccessMode Mode,
    IReadOnlyCollection<long> WriterUserIds);
