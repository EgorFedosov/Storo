using backend.Infrastructure.Persistence;
using backend.Modules.Inventories.Domain;
using backend.Modules.Users.UseCases.ListCurrentUserInventories;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Users.Infrastructure.Persistence;

public sealed class EfCoreUserInventoryReadModel(AppDbContext dbContext) : IUserInventoryReadModel
{
    public async Task<InventoryTableResult> ListCurrentUserInventoriesAsync(
        CurrentUserInventoriesReadModelQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var inventoriesQuery = dbContext.Inventories.AsNoTracking();
        inventoriesQuery = ApplyRelationFilter(inventoriesQuery, query);
        inventoriesQuery = ApplySearchFilter(inventoriesQuery, query.SearchQuery);
        inventoriesQuery = ApplySort(inventoriesQuery, query.SortField, query.SortDirection);

        var totalCount = await inventoriesQuery.CountAsync(cancellationToken);
        var skip = (query.Page - 1) * query.PageSize;

        var items = await inventoriesQuery
            .Skip(skip)
            .Take(query.PageSize)
            .Select(inventory => new InventoryTableRowResult(
                inventory.Id,
                inventory.Title,
                inventory.CategoryId,
                inventory.Category.Name,
                inventory.CreatorId,
                inventory.Creator.UserName,
                inventory.Creator.DisplayName,
                inventory.IsPublic,
                inventory.Items.Count(),
                inventory.CreatedAt,
                inventory.UpdatedAt))
            .ToArrayAsync(cancellationToken);

        return new InventoryTableResult(
            query.Relation,
            items,
            query.Page,
            query.PageSize,
            totalCount,
            new InventoryTableSortResult(query.SortField, query.SortDirection));
    }

    private static IQueryable<Inventory> ApplyRelationFilter(
        IQueryable<Inventory> source,
        CurrentUserInventoriesReadModelQuery query)
    {
        if (query.Relation == InventoryRelation.Owned)
        {
            return source.Where(inventory => inventory.CreatorId == query.UserId);
        }

        var writableScope = source.Where(inventory => inventory.CreatorId != query.UserId);
        if (query.IsAdmin)
        {
            return writableScope;
        }

        return writableScope.Where(
            inventory => inventory.IsPublic
                         || inventory.AccessList.Any(access => access.UserId == query.UserId));
    }

    private static IQueryable<Inventory> ApplySearchFilter(IQueryable<Inventory> source, string? searchQuery)
    {
        if (string.IsNullOrWhiteSpace(searchQuery))
        {
            return source;
        }

        var pattern = $"%{searchQuery}%";
        return source.Where(inventory => EF.Functions.ILike(inventory.Title, pattern));
    }

    private static IQueryable<Inventory> ApplySort(
        IQueryable<Inventory> source,
        InventoryTableSortField field,
        InventoryTableSortDirection direction)
    {
        return (field, direction) switch
        {
            (InventoryTableSortField.UpdatedAt, InventoryTableSortDirection.Asc) => source
                .OrderBy(inventory => inventory.UpdatedAt)
                .ThenBy(inventory => inventory.Id),
            (InventoryTableSortField.UpdatedAt, InventoryTableSortDirection.Desc) => source
                .OrderByDescending(inventory => inventory.UpdatedAt)
                .ThenBy(inventory => inventory.Id),
            (InventoryTableSortField.CreatedAt, InventoryTableSortDirection.Asc) => source
                .OrderBy(inventory => inventory.CreatedAt)
                .ThenBy(inventory => inventory.Id),
            (InventoryTableSortField.CreatedAt, InventoryTableSortDirection.Desc) => source
                .OrderByDescending(inventory => inventory.CreatedAt)
                .ThenBy(inventory => inventory.Id),
            (InventoryTableSortField.Title, InventoryTableSortDirection.Asc) => source
                .OrderBy(inventory => inventory.Title)
                .ThenBy(inventory => inventory.Id),
            (InventoryTableSortField.Title, InventoryTableSortDirection.Desc) => source
                .OrderByDescending(inventory => inventory.Title)
                .ThenBy(inventory => inventory.Id),
            (InventoryTableSortField.ItemsCount, InventoryTableSortDirection.Asc) => source
                .OrderBy(inventory => inventory.Items.Count())
                .ThenBy(inventory => inventory.Id),
            (InventoryTableSortField.ItemsCount, InventoryTableSortDirection.Desc) => source
                .OrderByDescending(inventory => inventory.Items.Count())
                .ThenBy(inventory => inventory.Id),
            _ => source
                .OrderByDescending(inventory => inventory.UpdatedAt)
                .ThenBy(inventory => inventory.Id)
        };
    }
}
