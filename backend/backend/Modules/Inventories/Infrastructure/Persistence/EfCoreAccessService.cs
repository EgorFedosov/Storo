using backend.Infrastructure.Persistence;
using backend.Modules.Inventories.UseCases.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Inventories.Infrastructure.Persistence;

public sealed class EfCoreAccessService(AppDbContext dbContext) : IAccessService
{
    public async Task<IReadOnlyCollection<long>> ResolveExistingWriterIdsAsync(
        IReadOnlyCollection<long> candidateUserIds,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(candidateUserIds);
        cancellationToken.ThrowIfCancellationRequested();

        if (candidateUserIds.Count == 0)
        {
            return Array.Empty<long>();
        }

        return await dbContext.Users
            .AsNoTracking()
            .Where(user => candidateUserIds.Contains(user.Id))
            .Select(user => user.Id)
            .ToArrayAsync(cancellationToken);
    }
}
