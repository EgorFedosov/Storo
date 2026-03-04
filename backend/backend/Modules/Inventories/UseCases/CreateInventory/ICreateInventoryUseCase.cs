using backend.Modules.Inventories.UseCases.GetInventoryDetails;

namespace backend.Modules.Inventories.UseCases.CreateInventory;

public interface ICreateInventoryUseCase
{
    Task<InventoryDetailsResult> ExecuteAsync(
        CreateInventoryCommand command,
        CancellationToken cancellationToken);
}
