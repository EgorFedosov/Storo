namespace backend.Modules.Inventories.Domain;

public sealed class CustomIdSequenceState
{
    public long InventoryId { get; set; }
    public long LastValue { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Inventory Inventory { get; set; } = null!;
}
