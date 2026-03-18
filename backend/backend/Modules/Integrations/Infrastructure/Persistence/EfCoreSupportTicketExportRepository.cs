using backend.Infrastructure.Persistence;
using backend.Modules.Integrations.Domain;
using backend.Modules.Integrations.UseCases.SupportTickets;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Integrations.Infrastructure.Persistence;

public sealed class EfCoreSupportTicketExportRepository(AppDbContext dbContext) : ISupportTicketExportRepository
{
    public Task AddAsync(
        SupportTicketExport supportTicketExport,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(supportTicketExport);

        return dbContext.SupportTicketExports
            .AddAsync(supportTicketExport, cancellationToken)
            .AsTask();
    }

    public Task<SupportTicketExport?> GetByTicketIdAsync(
        string ticketId,
        CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(ticketId);

        return dbContext.SupportTicketExports
            .AsNoTracking()
            .SingleOrDefaultAsync(
                supportTicketExport => supportTicketExport.TicketId == ticketId,
                cancellationToken);
    }
}
