namespace backend.Modules.Inventories.UseCases.CustomIdTemplate;

public sealed record PreviewCustomIdTemplateQuery(
    long InventoryId,
    long ActorUserId,
    bool ActorIsAdmin,
    bool IsEnabled,
    IReadOnlyList<CustomIdTemplatePartInput> Parts);
