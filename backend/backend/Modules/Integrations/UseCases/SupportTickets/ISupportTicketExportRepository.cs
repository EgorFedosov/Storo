using backend.Modules.Integrations.Domain;

namespace backend.Modules.Integrations.UseCases.SupportTickets;

public interface ISupportTicketExportRepository
{
    Task AddAsync(
        SupportTicketExport supportTicketExport,
        CancellationToken cancellationToken);

    Task<SupportTicketExport?> GetByTicketIdAsync(
        string ticketId,
        CancellationToken cancellationToken);
}
