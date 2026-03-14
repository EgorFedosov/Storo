using backend.Infrastructure.Persistence;
using backend.Modules.Inventories.Domain;
using backend.Modules.Inventories.UseCases.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Inventories.Infrastructure.Persistence;

public sealed class EfCoreInventoryRepository(AppDbContext dbContext) : IInventoryRepository
{
    public Task<bool> CategoryExistsAsync(int categoryId, CancellationToken cancellationToken)
    {
        return dbContext.Categories
            .AsNoTracking()
            .AnyAsync(category => category.Id == categoryId, cancellationToken);
    }

    public Task AddAsync(Inventory inventory, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(inventory);
        return dbContext.Inventories.AddAsync(inventory, cancellationToken).AsTask();
    }

    public Task<Inventory?> GetForUpdateAsync(long inventoryId, CancellationToken cancellationToken)
    {
        return dbContext.Inventories
            .AsSplitQuery()
            .Include(inventory => inventory.InventoryTags)
            .ThenInclude(inventoryTag => inventoryTag.Tag)
            .Include(inventory => inventory.AccessList)
            .Include(inventory => inventory.CustomFields)
            .Include(inventory => inventory.CustomIdTemplate!)
            .ThenInclude(template => template.Parts)
            .SingleOrDefaultAsync(inventory => inventory.Id == inventoryId, cancellationToken);
    }

    public void Delete(Inventory inventory)
    {
        ArgumentNullException.ThrowIfNull(inventory);
        dbContext.Inventories.Remove(inventory);
    }

    public async Task<InventoryDetailsAggregate?> GetDetailsAsync(
        long inventoryId,
        long? viewerUserId,
        CancellationToken cancellationToken)
    {
        var hasViewer = viewerUserId.HasValue;
        var viewerId = viewerUserId.GetValueOrDefault();

        var aggregate = await dbContext.Inventories
            .AsNoTracking()
            .Where(inventory => inventory.Id == inventoryId)
            .Select(inventory => new InventoryDetailsAggregate(
                inventory.Id,
                inventory.Version,
                inventory.Title,
                inventory.DescriptionMarkdown,
                inventory.CategoryId,
                inventory.Category.Name,
                inventory.ImageUrl,
                inventory.IsPublic,
                inventory.CreatedAt,
                inventory.UpdatedAt,
                inventory.CreatorId,
                inventory.Creator.UserName,
                inventory.Creator.DisplayName,
                inventory.Statistics == null ? 0 : inventory.Statistics.ItemsCount,
                hasViewer && inventory.AccessList.Any(access => access.UserId == viewerId),
                inventory.InventoryTags
                    .OrderBy(inventoryTag => inventoryTag.Tag.Name)
                    .Select(inventoryTag => new InventoryTagAggregate(
                        inventoryTag.TagId,
                        inventoryTag.Tag.Name))
                    .ToArray()))
            .SingleOrDefaultAsync(cancellationToken);

        if (aggregate is null)
        {
            return null;
        }

        var itemsCount = await dbContext.Items
            .AsNoTracking()
            .Where(item => item.InventoryId == inventoryId)
            .CountAsync(cancellationToken);

        return aggregate with { ItemsCount = itemsCount };
    }
}
