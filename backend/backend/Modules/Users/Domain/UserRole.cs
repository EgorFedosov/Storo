namespace backend.Modules.Users.Domain;

public sealed class UserRole
{
    public long UserId { get; set; }
    public int RoleId { get; set; }

    public User User { get; set; } = null!;
    public Role Role { get; set; } = null!;
}
