using backend.Infrastructure.Persistence;
using backend.Modules.Inventories.Domain;
using backend.Modules.Items.Domain;
using backend.Modules.Items.UseCases.CreateItem;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Items.Infrastructure.Persistence;

public sealed class EfCoreItemRepository(AppDbContext dbContext) : IItemRepository
{
    public Task<Inventory?> GetInventoryForCreateAsync(
        long inventoryId,
        CancellationToken cancellationToken)
    {
        return dbContext.Inventories
            .AsSplitQuery()
            .Include(inventory => inventory.AccessList)
            .Include(inventory => inventory.CustomFields)
            .Include(inventory => inventory.CustomIdTemplate!)
            .ThenInclude(template => template.Parts)
            .Include(inventory => inventory.CustomIdSequenceState)
            .SingleOrDefaultAsync(inventory => inventory.Id == inventoryId, cancellationToken);
    }

    public Task AddAsync(Item item, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(item);
        return dbContext.Items.AddAsync(item, cancellationToken).AsTask();
    }

    public Task<ItemUserResult?> GetUserSummaryAsync(
        long userId,
        CancellationToken cancellationToken)
    {
        return dbContext.Users
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => new ItemUserResult(
                user.Id,
                user.UserName,
                user.DisplayName))
            .SingleOrDefaultAsync(cancellationToken);
    }
}
