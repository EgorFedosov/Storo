using backend.Modules.Inventories.Domain;

namespace backend.Modules.Items.Domain;

public sealed class ItemCustomFieldValue
{
    public long Id { get; set; }
    public long ItemId { get; set; }
    public long CustomFieldId { get; set; }
    public string? StringValue { get; set; }
    public string? TextValue { get; set; }
    public decimal? NumberValue { get; set; }
    public string? LinkValue { get; set; }
    public bool? BoolValue { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Item Item { get; set; } = null!;
    public CustomField CustomField { get; set; } = null!;
}
