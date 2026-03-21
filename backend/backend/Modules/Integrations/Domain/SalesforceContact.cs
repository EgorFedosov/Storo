using backend.Modules.Users.Domain;

namespace backend.Modules.Integrations.Domain;

public sealed class SalesforceContact
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string? SfAccountId { get; set; }
    public string? SfContactId { get; set; }
    public string SyncStatus { get; set; } = string.Empty;
    public DateTime? LastSyncAtUtc { get; set; }
    public string? LastError { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public User User { get; set; } = null!;
}
