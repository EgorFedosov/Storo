using backend.Modules.Users.Domain;

namespace backend.Modules.Inventories.Domain;

public sealed class InventoryAccess
{
    public long InventoryId { get; set; }
    public long UserId { get; set; }
    public long GrantedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }

    public Inventory Inventory { get; set; } = null!;
    public User User { get; set; } = null!;
    public User GrantedByUser { get; set; } = null!;
}
