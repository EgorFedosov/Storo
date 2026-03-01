namespace backend.Modules.Inventories.Domain;

public sealed class InventoryStringFieldStatistic
{
    public long Id { get; set; }
    public long InventoryId { get; set; }
    public long CustomFieldId { get; set; }
    public string? MostFrequentValue { get; set; }
    public int MostFrequentCount { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Inventory Inventory { get; set; } = null!;
    public CustomField CustomField { get; set; } = null!;
}
