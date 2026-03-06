using backend.Modules.Inventories.Domain;
using backend.Modules.Items.Domain;

namespace backend.Modules.Items.UseCases.CreateItem;

public interface IItemRepository
{
    Task<Inventory?> GetInventoryForCreateAsync(
        long inventoryId,
        CancellationToken cancellationToken);

    Task AddAsync(
        Item item,
        CancellationToken cancellationToken);

    Task<ItemUserResult?> GetUserSummaryAsync(
        long userId,
        CancellationToken cancellationToken);
}
