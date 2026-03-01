namespace backend.Modules.Inventories.Domain;

public sealed class CustomIdTemplate
{
    public long Id { get; set; }
    public long InventoryId { get; set; }
    public bool IsEnabled { get; set; }
    public string? ValidationRegex { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Inventory Inventory { get; set; } = null!;
    public ICollection<CustomIdTemplatePart> Parts { get; set; } = new List<CustomIdTemplatePart>();
}
