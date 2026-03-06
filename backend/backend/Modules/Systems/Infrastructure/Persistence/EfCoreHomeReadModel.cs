using backend.Infrastructure.Persistence;
using backend.Modules.Systems.UseCases.Home;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Systems.Infrastructure.Persistence;

public sealed class EfCoreHomeReadModel(AppDbContext dbContext) : IHomeReadModel
{
    private const int LatestInventoriesLimit = 10;
    private const int PopularInventoriesLimit = 5;
    private const int TagCloudLimit = 30;

    public async Task<HomePageDataResult> GetHomePageDataAsync(
        GetHomePageDataQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var latestInventories = await dbContext.Inventories
            .AsNoTracking()
            .OrderByDescending(inventory => inventory.CreatedAt)
            .ThenBy(inventory => inventory.Id)
            .Take(LatestInventoriesLimit)
            .Select(inventory => new HomeInventoryProjection(
                inventory.Id,
                inventory.Title,
                inventory.DescriptionMarkdown,
                inventory.ImageUrl,
                inventory.Statistics == null ? 0 : inventory.Statistics.ItemsCount,
                inventory.CreatedAt,
                inventory.UpdatedAt,
                inventory.CreatorId,
                inventory.Creator.UserName,
                inventory.Creator.DisplayName))
            .ToArrayAsync(cancellationToken);

        var topPopularInventories = await dbContext.Inventories
            .AsNoTracking()
            .OrderByDescending(inventory => inventory.Statistics == null ? 0 : inventory.Statistics.ItemsCount)
            .ThenByDescending(inventory => inventory.CreatedAt)
            .ThenBy(inventory => inventory.Id)
            .Take(PopularInventoriesLimit)
            .Select(inventory => new HomeInventoryProjection(
                inventory.Id,
                inventory.Title,
                inventory.DescriptionMarkdown,
                inventory.ImageUrl,
                inventory.Statistics == null ? 0 : inventory.Statistics.ItemsCount,
                inventory.CreatedAt,
                inventory.UpdatedAt,
                inventory.CreatorId,
                inventory.Creator.UserName,
                inventory.Creator.DisplayName))
            .ToArrayAsync(cancellationToken);

        var tagCloud = await dbContext.Tags
            .AsNoTracking()
            .Where(tag => tag.InventoryTags.Any())
            .Select(tag => new HomeTagCloudItemResult(
                tag.Id,
                tag.Name,
                tag.InventoryTags.Count()))
            .OrderByDescending(tag => tag.Count)
            .ThenBy(tag => tag.Name)
            .ThenBy(tag => tag.Id)
            .Take(TagCloudLimit)
            .ToArrayAsync(cancellationToken);

        return new HomePageDataResult(
            latestInventories.Select(MapInventory).ToArray(),
            topPopularInventories.Select(MapInventory).ToArray(),
            tagCloud);
    }

    private static HomeInventorySummaryResult MapInventory(HomeInventoryProjection projection)
    {
        ArgumentNullException.ThrowIfNull(projection);

        return new HomeInventorySummaryResult(
            projection.Id,
            projection.Title,
            projection.DescriptionMarkdown,
            projection.ImageUrl,
            projection.ItemsCount,
            projection.CreatedAt,
            projection.UpdatedAt,
            new HomeInventoryCreatorResult(
                projection.CreatorId,
                projection.CreatorUserName,
                projection.CreatorDisplayName));
    }

    private sealed record HomeInventoryProjection(
        long Id,
        string Title,
        string DescriptionMarkdown,
        string? ImageUrl,
        int ItemsCount,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        long CreatorId,
        string CreatorUserName,
        string CreatorDisplayName);
}
