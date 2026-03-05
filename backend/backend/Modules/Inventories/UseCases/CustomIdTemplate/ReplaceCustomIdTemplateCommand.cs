using backend.Modules.Concurrency.UseCases.Versioning;

namespace backend.Modules.Inventories.UseCases.CustomIdTemplate;

public sealed record ReplaceCustomIdTemplateCommand(
    long InventoryId,
    long ActorUserId,
    bool ActorIsAdmin,
    IfMatchToken IfMatchToken,
    bool IsEnabled,
    IReadOnlyList<CustomIdTemplatePartInput> Parts);
