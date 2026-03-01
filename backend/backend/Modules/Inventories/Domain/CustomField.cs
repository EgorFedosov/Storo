using backend.Modules.Items.Domain;

namespace backend.Modules.Inventories.Domain;

public sealed class CustomField
{
    public long Id { get; set; }
    public long InventoryId { get; set; }
    public CustomFieldType FieldType { get; set; }
    public int SlotNo { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool ShowInTable { get; set; }
    public int SortOrder { get; set; }
    public bool IsEnabled { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Inventory Inventory { get; set; } = null!;
    public ICollection<ItemCustomFieldValue> Values { get; set; } = new List<ItemCustomFieldValue>();
    public ICollection<InventoryNumericFieldStatistic> NumericStatistics { get; set; } =
        new List<InventoryNumericFieldStatistic>();
    public ICollection<InventoryStringFieldStatistic> StringStatistics { get; set; } =
        new List<InventoryStringFieldStatistic>();
}
