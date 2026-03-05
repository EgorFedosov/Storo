using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Inventories.Domain;

namespace backend.Modules.Inventories.UseCases.EditorMutations;

public sealed record ReplaceInventoryCustomFieldsCommand(
    long InventoryId,
    long ActorUserId,
    bool ActorIsAdmin,
    IfMatchToken IfMatchToken,
    IReadOnlyList<ReplaceInventoryCustomFieldInput> Fields);

public sealed record ReplaceInventoryCustomFieldInput(
    long? Id,
    CustomFieldType FieldType,
    string Title,
    string Description,
    bool ShowInTable);
