using backend.Modules.Users.Domain;

namespace backend.Modules.Items.Domain;

public sealed class ItemLike
{
    public long ItemId { get; set; }
    public long UserId { get; set; }
    public DateTime CreatedAt { get; set; }

    public Item Item { get; set; } = null!;
    public User User { get; set; } = null!;
}
