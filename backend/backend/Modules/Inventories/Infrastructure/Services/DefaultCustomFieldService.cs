using backend.Modules.Inventories.Domain;
using backend.Modules.Inventories.UseCases.EditorMutations;

namespace backend.Modules.Inventories.Infrastructure.Services;

public sealed class DefaultCustomFieldService : ICustomFieldService
{
    private const int MaxFieldsPerType = 3;

    public IReadOnlyList<CustomField> Replace(
        Inventory inventory,
        IReadOnlyList<ReplaceInventoryCustomFieldInput> requestedFields,
        DateTime nowUtc)
    {
        ArgumentNullException.ThrowIfNull(inventory);
        ArgumentNullException.ThrowIfNull(requestedFields);

        var fieldsById = inventory.CustomFields.ToDictionary(field => field.Id);
        var selectedIds = new HashSet<long>();

        foreach (var requestedField in requestedFields)
        {
            if (!requestedField.Id.HasValue)
            {
                continue;
            }

            var fieldId = requestedField.Id.Value;
            if (!fieldsById.TryGetValue(fieldId, out var existingField))
            {
                throw new InventoryCustomFieldNotFoundException(fieldId);
            }

            if (existingField.FieldType != requestedField.FieldType)
            {
                throw new InventoryCustomFieldTypeChangeNotAllowedException(
                    fieldId,
                    existingField.FieldType,
                    requestedField.FieldType);
            }

            selectedIds.Add(fieldId);
        }

        foreach (var field in inventory.CustomFields.Where(field => !selectedIds.Contains(field.Id)))
        {
            if (field.IsEnabled)
            {
                field.IsEnabled = false;
                field.UpdatedAt = nowUtc;
            }
        }

        var reusableByType = inventory.CustomFields
            .Where(field => !selectedIds.Contains(field.Id))
            .GroupBy(field => field.FieldType)
            .ToDictionary(
                group => group.Key,
                group => new Queue<CustomField>(
                    group.OrderBy(field => field.SortOrder).ThenBy(field => field.Id)));

        var occupiedSlotsByType = new Dictionary<CustomFieldType, HashSet<int>>();
        foreach (var field in inventory.CustomFields)
        {
            if (!occupiedSlotsByType.TryGetValue(field.FieldType, out var slots))
            {
                slots = new HashSet<int>();
                occupiedSlotsByType[field.FieldType] = slots;
            }

            slots.Add(field.SlotNo);
        }

        var activeFields = new List<CustomField>(requestedFields.Count);

        for (var i = 0; i < requestedFields.Count; i++)
        {
            var requestedField = requestedFields[i];
            var fieldType = requestedField.FieldType;

            if (!occupiedSlotsByType.TryGetValue(fieldType, out var occupiedSlots))
            {
                occupiedSlots = new HashSet<int>();
                occupiedSlotsByType[fieldType] = occupiedSlots;
            }

            CustomField field;
            if (requestedField.Id.HasValue)
            {
                field = fieldsById[requestedField.Id.Value];
            }
            else if (reusableByType.TryGetValue(fieldType, out var reusableFields) && reusableFields.Count > 0)
            {
                field = reusableFields.Dequeue();
            }
            else
            {
                if (occupiedSlots.Count >= MaxFieldsPerType)
                {
                    throw new InventoryCustomFieldSlotsExhaustedException(fieldType);
                }

                field = new CustomField
                {
                    InventoryId = inventory.Id,
                    SlotNo = FindFreeSlot(occupiedSlots, fieldType),
                    CreatedAt = nowUtc
                };

                inventory.CustomFields.Add(field);
                occupiedSlots.Add(field.SlotNo);
            }

            field.FieldType = fieldType;
            field.Title = requestedField.Title;
            field.Description = requestedField.Description;
            field.ShowInTable = requestedField.ShowInTable;
            field.SortOrder = i + 1;
            field.IsEnabled = true;
            field.UpdatedAt = nowUtc;

            activeFields.Add(field);
        }

        return activeFields;
    }

    private static int FindFreeSlot(HashSet<int> occupiedSlots, CustomFieldType fieldType)
    {
        for (var slot = 1; slot <= MaxFieldsPerType; slot++)
        {
            if (!occupiedSlots.Contains(slot))
            {
                return slot;
            }
        }

        throw new InventoryCustomFieldSlotsExhaustedException(fieldType);
    }
}
