using System.Globalization;

namespace backend.Modules.Items.UseCases.ListInventoryItems;

public sealed class InventoryItemsInventoryNotFoundException(long inventoryId)
    : Exception($"Inventory with id '{inventoryId.ToString(CultureInfo.InvariantCulture)}' was not found.")
{
    public long InventoryId { get; } = inventoryId;
}
