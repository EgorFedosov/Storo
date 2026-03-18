using backend.Modules.Inventories.Domain;
using backend.Modules.Users.Domain;

namespace backend.Modules.Integrations.Domain;

public sealed class SupportTicketExport
{
    public long Id { get; set; }
    public string TicketId { get; set; } = string.Empty;
    public long ReportedByUserId { get; set; }
    public long? InventoryId { get; set; }
    public string Summary { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string PageLink { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public string AdminsEmailsSnapshot { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? UploadedFileRef { get; set; }
    public string? ProviderFileId { get; set; }
    public string? ProviderRev { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UploadedAtUtc { get; set; }

    public User ReportedByUser { get; set; } = null!;
    public Inventory? Inventory { get; set; }
}
