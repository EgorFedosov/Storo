using backend.Modules.Users.Domain;

namespace backend.Modules.Inventories.Domain;

public sealed class InventoryApiToken
{
    public long Id { get; set; }
    public long InventoryId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public long CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? RevokedAt { get; set; }

    public Inventory Inventory { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
}
