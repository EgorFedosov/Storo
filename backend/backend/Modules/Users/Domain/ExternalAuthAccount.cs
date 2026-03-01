namespace backend.Modules.Users.Domain;

public sealed class ExternalAuthAccount
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string ProviderUserId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
}
