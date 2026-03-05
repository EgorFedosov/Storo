using backend.Modules.Inventories.Domain;

namespace backend.Modules.Inventories.UseCases.EditorMutations;

public sealed record InventoryVersionResult(
    int Version,
    IReadOnlyList<InventoryVersionCustomFieldResult>? ActiveCustomFields = null);

public sealed record InventoryVersionCustomFieldResult(
    long Id,
    CustomFieldType FieldType,
    string Title,
    string Description,
    bool ShowInTable);
