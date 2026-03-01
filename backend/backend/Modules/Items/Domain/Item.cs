using backend.Modules.Inventories.Domain;
using backend.Modules.Users.Domain;

namespace backend.Modules.Items.Domain;

public sealed class Item
{
    public long Id { get; set; }
    public long InventoryId { get; set; }
    public string CustomId { get; set; } = string.Empty;
    public long? CreatedByUserId { get; set; }
    public long? UpdatedByUserId { get; set; }
    public int Version { get; set; } = 1;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Inventory Inventory { get; set; } = null!;
    public User? CreatedByUser { get; set; }
    public User? UpdatedByUser { get; set; }
    public ICollection<ItemCustomFieldValue> CustomFieldValues { get; set; } = new List<ItemCustomFieldValue>();
    public ICollection<ItemLike> Likes { get; set; } = new List<ItemLike>();
}
