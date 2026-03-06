using backend.Modules.Inventories.UseCases.GetInventoryDetails;

namespace backend.Modules.Inventories.UseCases.Statistics;

public sealed class GetInventoryStatisticsUseCase(IStatisticsReadModel statisticsReadModel) : IGetInventoryStatisticsUseCase
{
    public async Task<InventoryStatisticsResult> ExecuteAsync(
        GetInventoryStatisticsQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var result = await statisticsReadModel.GetInventoryStatisticsAsync(query, cancellationToken);
        if (result is null)
        {
            throw new InventoryNotFoundException(query.InventoryId);
        }

        return result;
    }
}
