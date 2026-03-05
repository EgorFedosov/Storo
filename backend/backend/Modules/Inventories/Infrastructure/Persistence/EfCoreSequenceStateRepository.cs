using backend.Infrastructure.Persistence;
using backend.Modules.Inventories.UseCases.CustomIdTemplate;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Inventories.Infrastructure.Persistence;

public sealed class EfCoreSequenceStateRepository(AppDbContext dbContext) : ISequenceStateRepository
{
    public Task<long?> GetLastValueAsync(long inventoryId, CancellationToken cancellationToken)
    {
        return dbContext.CustomIdSequenceState
            .AsNoTracking()
            .Where(state => state.InventoryId == inventoryId)
            .Select(state => (long?)state.LastValue)
            .SingleOrDefaultAsync(cancellationToken);
    }
}
