using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Inventories.UseCases.Abstractions;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;

namespace backend.Modules.Inventories.UseCases.DeleteInventory;

public sealed class DeleteInventoryUseCase(
    IInventoryRepository inventoryRepository,
    IUnitOfWork unitOfWork) : IDeleteInventoryUseCase
{
    public async Task<DeleteInventoryResult> ExecuteAsync(
        DeleteInventoryCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        var inventory = await inventoryRepository.GetForUpdateAsync(command.InventoryId, cancellationToken);
        if (inventory is null)
        {
            throw new InventoryNotFoundException(command.InventoryId);
        }

        if (!command.ActorIsAdmin && inventory.CreatorId != command.ActorUserId)
        {
            throw new InventoryDeleteAccessDeniedException(command.InventoryId, command.ActorUserId);
        }

        if (command.IfMatchToken.Version != inventory.Version)
        {
            throw new ConcurrencyConflictException(command.IfMatchToken.Version, inventory.Version);
        }

        inventoryRepository.Delete(inventory);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return DeleteInventoryResult.Deleted;
    }
}
