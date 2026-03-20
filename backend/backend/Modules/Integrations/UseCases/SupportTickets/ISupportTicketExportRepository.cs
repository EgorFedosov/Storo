using backend.Modules.Integrations.Domain;

namespace backend.Modules.Integrations.UseCases.SupportTickets;

public interface ISupportTicketExportRepository
{
    Task AddAsync(
        SupportTicketExport supportTicketExport,
        CancellationToken cancellationToken);

    Task<SupportTicketInventoryContext?> GetInventoryContextAsync(
        long inventoryId,
        long actorUserId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<string>> ListAdminEmailsAsync(CancellationToken cancellationToken);

    Task<SupportTicketExport?> GetByTicketIdAsync(
        string ticketId,
        CancellationToken cancellationToken);
}

public sealed record SupportTicketInventoryContext(
    long InventoryId,
    string InventoryTitle,
    bool IsPublic,
    long CreatorUserId,
    bool ActorHasExplicitAccess);
