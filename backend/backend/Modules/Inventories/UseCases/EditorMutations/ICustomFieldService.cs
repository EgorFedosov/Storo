using backend.Modules.Inventories.Domain;

namespace backend.Modules.Inventories.UseCases.EditorMutations;

public interface ICustomFieldService
{
    IReadOnlyList<CustomField> Replace(
        Inventory inventory,
        IReadOnlyList<ReplaceInventoryCustomFieldInput> requestedFields,
        DateTime nowUtc);
}
