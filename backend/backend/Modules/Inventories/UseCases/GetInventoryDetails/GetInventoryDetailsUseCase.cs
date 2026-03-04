using backend.Modules.Inventories.UseCases.Abstractions;

namespace backend.Modules.Inventories.UseCases.GetInventoryDetails;

public sealed class GetInventoryDetailsUseCase(IInventoryRepository inventoryRepository) : IGetInventoryDetailsUseCase
{
    public async Task<InventoryDetailsResult> ExecuteAsync(
        GetInventoryDetailsQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var aggregate = await inventoryRepository.GetDetailsAsync(
            query.InventoryId,
            query.ViewerContext.UserId,
            cancellationToken);

        if (aggregate is null)
        {
            throw new InventoryNotFoundException(query.InventoryId);
        }

        return InventoryDetailsResultFactory.Create(aggregate, query.ViewerContext);
    }
}
