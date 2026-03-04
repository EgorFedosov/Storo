namespace backend.Modules.Inventories.UseCases.GetInventoryDetails;

public interface IGetInventoryDetailsUseCase
{
    Task<InventoryDetailsResult> ExecuteAsync(
        GetInventoryDetailsQuery query,
        CancellationToken cancellationToken);
}
