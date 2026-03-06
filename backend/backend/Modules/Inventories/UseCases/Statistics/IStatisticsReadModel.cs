namespace backend.Modules.Inventories.UseCases.Statistics;

public interface IStatisticsReadModel
{
    Task<InventoryStatisticsResult?> GetInventoryStatisticsAsync(
        GetInventoryStatisticsQuery query,
        CancellationToken cancellationToken);
}
