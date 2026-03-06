using System.Globalization;
using System.Linq;

namespace backend.Modules.Items.UseCases.CreateItem;

public sealed class ItemInventoryNotFoundException(long inventoryId)
    : Exception($"Inventory '{inventoryId.ToString(CultureInfo.InvariantCulture)}' was not found.")
{
    public long InventoryId { get; } = inventoryId;
}

public sealed class CreateItemAccessDeniedException(long inventoryId, long actorUserId)
    : Exception(
        $"User '{actorUserId.ToString(CultureInfo.InvariantCulture)}' does not have write access to inventory '{inventoryId.ToString(CultureInfo.InvariantCulture)}'.")
{
    public long InventoryId { get; } = inventoryId;
    public long ActorUserId { get; } = actorUserId;
}

public sealed class ItemCustomIdConflictException(long inventoryId, string customId)
    : Exception(
        $"Custom id '{customId}' already exists in inventory '{inventoryId.ToString(CultureInfo.InvariantCulture)}'.")
{
    public long InventoryId { get; } = inventoryId;
    public string CustomId { get; } = customId;
}

public sealed class ItemValidationException : Exception
{
    public ItemValidationException(IReadOnlyDictionary<string, string[]> errors)
        : base("Validation failed for create-item request.")
    {
        ArgumentNullException.ThrowIfNull(errors);
        Errors = errors.ToDictionary(
            static pair => pair.Key,
            static pair => pair.Value,
            StringComparer.Ordinal);
    }

    public IReadOnlyDictionary<string, string[]> Errors { get; }
}
