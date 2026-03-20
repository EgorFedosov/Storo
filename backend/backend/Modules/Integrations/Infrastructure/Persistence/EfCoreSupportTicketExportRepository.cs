using backend.Infrastructure.Persistence;
using backend.Modules.Integrations.Domain;
using backend.Modules.Integrations.UseCases.SupportTickets;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Integrations.Infrastructure.Persistence;

public sealed class EfCoreSupportTicketExportRepository(AppDbContext dbContext) : ISupportTicketExportRepository
{
    private const string AdminRoleName = "admin";

    public Task AddAsync(
        SupportTicketExport supportTicketExport,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(supportTicketExport);

        return dbContext.SupportTicketExports
            .AddAsync(supportTicketExport, cancellationToken)
            .AsTask();
    }

    public Task<SupportTicketInventoryContext?> GetInventoryContextAsync(
        long inventoryId,
        long actorUserId,
        CancellationToken cancellationToken)
    {
        if (inventoryId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(inventoryId), "Inventory id must be positive.");
        }

        if (actorUserId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(actorUserId), "Actor user id must be positive.");
        }

        return dbContext.Inventories
            .AsNoTracking()
            .Where(inventory => inventory.Id == inventoryId)
            .Select(inventory => new SupportTicketInventoryContext(
                inventory.Id,
                inventory.Title,
                inventory.IsPublic,
                inventory.CreatorId,
                inventory.AccessList.Any(access => access.UserId == actorUserId)))
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<string>> ListAdminEmailsAsync(CancellationToken cancellationToken)
    {
        var emails = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.UserRoles.Any(userRole => userRole.Role.Name == AdminRoleName))
            .Select(user => user.Email)
            .ToArrayAsync(cancellationToken);

        return emails
            .Where(email => !string.IsNullOrWhiteSpace(email))
            .Select(email => email.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(email => email, StringComparer.OrdinalIgnoreCase)
            .ToArray();
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
