using backend.Modules.Concurrency.UseCases.Versioning;

namespace backend.Modules.Inventories.UseCases.EditorMutations;

public sealed record ReplaceInventoryTagsCommand(
    long InventoryId,
    long ActorUserId,
    bool ActorIsAdmin,
    IfMatchToken IfMatchToken,
    IReadOnlyCollection<string> Tags);
