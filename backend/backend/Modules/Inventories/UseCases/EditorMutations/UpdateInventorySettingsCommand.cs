using backend.Modules.Concurrency.UseCases.Versioning;

namespace backend.Modules.Inventories.UseCases.EditorMutations;

public sealed record UpdateInventorySettingsCommand(
    long InventoryId,
    long ActorUserId,
    bool ActorIsAdmin,
    IfMatchToken IfMatchToken,
    string Title,
    string DescriptionMarkdown,
    int CategoryId,
    string? ImageUrl);
