namespace backend.Modules.Inventories.Domain;

public sealed class InventoryNumericFieldStatistic
{
    public long Id { get; set; }
    public long InventoryId { get; set; }
    public long CustomFieldId { get; set; }
    public decimal? MinValue { get; set; }
    public decimal? MaxValue { get; set; }
    public decimal? AvgValue { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Inventory Inventory { get; set; } = null!;
    public CustomField CustomField { get; set; } = null!;
}
