using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Inventories.Domain;
using backend.Modules.Items.UseCases.CreateItem;
using backend.Modules.Items.UseCases.ItemLifecycle;

namespace backend.Modules.Items.UseCases.DeleteItem;

public sealed class DeleteItemUseCase(
    IItemRepository itemRepository,
    IUnitOfWork unitOfWork) : IDeleteItemUseCase
{
    public async Task<DeleteItemResult> ExecuteAsync(
        DeleteItemCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        var item = await itemRepository.GetForUpdateAsync(command.ItemId, cancellationToken);
        if (item is null)
        {
            throw new ItemNotFoundException(command.ItemId);
        }

        if (!CanWriteItems(item.Inventory, command.ActorUserId, command.ActorIsAdmin))
        {
            throw new ItemWriteAccessDeniedException(item.Id, item.InventoryId, command.ActorUserId);
        }

        if (command.IfMatchToken.Version != item.Version)
        {
            throw new ConcurrencyConflictException(command.IfMatchToken.Version, item.Version);
        }

        itemRepository.Delete(item);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return DeleteItemResult.Deleted;
    }

    private static bool CanWriteItems(Inventory inventory, long actorUserId, bool actorIsAdmin)
    {
        ArgumentNullException.ThrowIfNull(inventory);

        if (actorIsAdmin || inventory.CreatorId == actorUserId || inventory.IsPublic)
        {
            return true;
        }

        return inventory.AccessList.Any(access => access.UserId == actorUserId);
    }
}
