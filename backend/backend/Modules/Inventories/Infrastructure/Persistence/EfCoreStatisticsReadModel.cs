using backend.Infrastructure.Persistence;
using backend.Modules.Inventories.UseCases.Statistics;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Inventories.Infrastructure.Persistence;

public sealed class EfCoreStatisticsReadModel(AppDbContext dbContext) : IStatisticsReadModel
{
    public async Task<InventoryStatisticsResult?> GetInventoryStatisticsAsync(
        GetInventoryStatisticsQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var snapshot = await dbContext.Inventories
            .AsNoTracking()
            .Where(inventory => inventory.Id == query.InventoryId)
            .Select(inventory => new InventoryStatisticsSnapshot(
                inventory.Id,
                inventory.Statistics == null ? inventory.UpdatedAt : inventory.Statistics.UpdatedAt,
                inventory.Statistics == null ? 0 : inventory.Statistics.ItemsCount))
            .SingleOrDefaultAsync(cancellationToken);

        if (snapshot is null)
        {
            return null;
        }

        var numericFields = await dbContext.InventoryNumericFieldStatistics
            .AsNoTracking()
            .Where(statistic => statistic.InventoryId == query.InventoryId && statistic.CustomField.IsEnabled)
            .OrderBy(statistic => statistic.CustomField.SortOrder)
            .ThenBy(statistic => statistic.CustomFieldId)
            .Select(statistic => new InventoryNumericFieldStatisticsResult(
                statistic.CustomFieldId,
                statistic.CustomField.Title,
                statistic.MinValue,
                statistic.MaxValue,
                statistic.AvgValue))
            .ToArrayAsync(cancellationToken);

        var stringFields = await dbContext.InventoryStringFieldStatistics
            .AsNoTracking()
            .Where(statistic => statistic.InventoryId == query.InventoryId && statistic.CustomField.IsEnabled)
            .OrderBy(statistic => statistic.CustomField.SortOrder)
            .ThenBy(statistic => statistic.CustomFieldId)
            .Select(statistic => new InventoryStringFieldStatisticsResult(
                statistic.CustomFieldId,
                statistic.CustomField.Title,
                statistic.MostFrequentValue,
                statistic.MostFrequentCount))
            .ToArrayAsync(cancellationToken);

        return new InventoryStatisticsResult(
            snapshot.InventoryId,
            snapshot.UpdatedAt,
            snapshot.ItemsCount,
            numericFields,
            stringFields);
    }

    private sealed record InventoryStatisticsSnapshot(
        long InventoryId,
        DateTime UpdatedAt,
        int ItemsCount);
}
