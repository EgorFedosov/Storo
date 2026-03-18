using backend.Infrastructure.Persistence;
using backend.Modules.Inventories.Domain;
using backend.Modules.Inventories.UseCases.OdooToken;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Inventories.Infrastructure.Persistence;

public sealed class EfCoreInventoryApiTokenRepository(AppDbContext dbContext) : IInventoryApiTokenRepository
{
    public Task<InventoryApiToken?> GetActiveForUpdateAsync(
        long inventoryId,
        CancellationToken cancellationToken)
    {
        return dbContext.InventoryApiTokens
            .SingleOrDefaultAsync(
                token => token.InventoryId == inventoryId && token.IsActive,
                cancellationToken);
    }

    public Task AddAsync(
        InventoryApiToken token,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(token);
        return dbContext.InventoryApiTokens.AddAsync(token, cancellationToken).AsTask();
    }
}
