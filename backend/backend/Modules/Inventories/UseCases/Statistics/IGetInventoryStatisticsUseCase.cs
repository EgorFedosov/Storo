namespace backend.Modules.Inventories.UseCases.Statistics;

public interface IGetInventoryStatisticsUseCase
{
    Task<InventoryStatisticsResult> ExecuteAsync(
        GetInventoryStatisticsQuery query,
        CancellationToken cancellationToken);
}
