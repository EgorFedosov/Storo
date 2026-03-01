namespace backend.Modules.Inventories.Domain;

public sealed class Tag
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public ICollection<InventoryTag> InventoryTags { get; set; } = new List<InventoryTag>();
}
