using backend.Modules.Users.Domain;

namespace backend.Modules.Inventories.Domain;

public sealed class DiscussionPost
{
    public long Id { get; set; }
    public long InventoryId { get; set; }
    public long AuthorUserId { get; set; }
    public string ContentMarkdown { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public Inventory Inventory { get; set; } = null!;
    public User AuthorUser { get; set; } = null!;
}
