namespace backend.Modules.Inventories.UseCases.GetInventoryDetails;

public sealed class InventoryNotFoundException(long inventoryId)
    : Exception($"Inventory with id '{inventoryId}' was not found.")
{
    public long InventoryId { get; } = inventoryId;
}

public sealed class InventoryCategoryNotFoundException(int categoryId)
    : Exception($"Category with id '{categoryId}' was not found.")
{
    public int CategoryId { get; } = categoryId;
}
