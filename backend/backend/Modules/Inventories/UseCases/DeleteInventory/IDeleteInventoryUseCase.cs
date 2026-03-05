namespace backend.Modules.Inventories.UseCases.DeleteInventory;

public interface IDeleteInventoryUseCase
{
    Task<DeleteInventoryResult> ExecuteAsync(
        DeleteInventoryCommand command,
        CancellationToken cancellationToken);
}
