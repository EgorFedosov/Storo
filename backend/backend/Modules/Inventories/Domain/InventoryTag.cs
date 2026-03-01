namespace backend.Modules.Inventories.Domain;

public sealed class InventoryTag
{
    public long InventoryId { get; set; }
    public long TagId { get; set; }

    public Inventory Inventory { get; set; } = null!;
    public Tag Tag { get; set; } = null!;
}
