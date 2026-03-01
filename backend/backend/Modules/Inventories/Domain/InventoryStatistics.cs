namespace backend.Modules.Inventories.Domain;

public sealed class InventoryStatistics
{
    public long InventoryId { get; set; }
    public int ItemsCount { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Inventory Inventory { get; set; } = null!;
}
