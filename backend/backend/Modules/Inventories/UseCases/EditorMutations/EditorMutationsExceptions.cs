using System.Globalization;
using backend.Modules.Inventories.Domain;

namespace backend.Modules.Inventories.UseCases.EditorMutations;

public sealed class InventoryEditorMutationAccessDeniedException(long inventoryId, long actorUserId)
    : Exception($"User '{actorUserId}' does not have write access to inventory '{inventoryId}'.")
{
    public long InventoryId { get; } = inventoryId;
    public long ActorUserId { get; } = actorUserId;
}

public sealed class InventoryAccessUsersNotFoundException(IReadOnlyList<long> missingUserIds)
    : Exception($"One or more users were not found: {FormatMissingIds(missingUserIds)}.")
{
    public IReadOnlyList<long> MissingUserIds { get; } = missingUserIds;

    private static string FormatMissingIds(IReadOnlyList<long> missingUserIds)
    {
        if (missingUserIds.Count == 0)
        {
            return "none";
        }

        return string.Join(
            ",",
            missingUserIds.Select(id => id.ToString(CultureInfo.InvariantCulture)));
    }
}

public sealed class InventoryCustomFieldNotFoundException(long fieldId)
    : Exception($"Field '{fieldId.ToString(CultureInfo.InvariantCulture)}' does not exist in the target inventory.")
{
    public long FieldId { get; } = fieldId;
}

public sealed class InventoryCustomFieldTypeChangeNotAllowedException(
    long fieldId,
    CustomFieldType currentType,
    CustomFieldType requestedType)
    : Exception(
        $"Field '{fieldId.ToString(CultureInfo.InvariantCulture)}' cannot change type from '{currentType}' to '{requestedType}'.")
{
    public long FieldId { get; } = fieldId;
    public CustomFieldType CurrentType { get; } = currentType;
    public CustomFieldType RequestedType { get; } = requestedType;
}

public sealed class InventoryCustomFieldSlotsExhaustedException(CustomFieldType fieldType)
    : Exception($"No free slot is available for field type '{fieldType}'.")
{
    public CustomFieldType FieldType { get; } = fieldType;
}
