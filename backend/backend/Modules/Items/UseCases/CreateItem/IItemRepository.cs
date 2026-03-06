using backend.Modules.Inventories.Domain;
using backend.Modules.Items.Domain;

namespace backend.Modules.Items.UseCases.CreateItem;

public interface IItemRepository
{
    Task<Inventory?> GetInventoryForCreateAsync(
        long inventoryId,
        CancellationToken cancellationToken);

    Task<ItemDetailsAggregate?> GetDetailsAsync(
        long itemId,
        long? viewerUserId,
        CancellationToken cancellationToken);

    Task<Item?> GetForUpdateAsync(
        long itemId,
        CancellationToken cancellationToken);

    Task AddAsync(
        Item item,
        CancellationToken cancellationToken);

    void Delete(Item item);

    Task<ItemUserResult?> GetUserSummaryAsync(
        long userId,
        CancellationToken cancellationToken);
}

public sealed record ItemDetailsAggregate(
    long Id,
    long InventoryId,
    string InventoryTitle,
    long InventoryCreatorId,
    bool InventoryIsPublic,
    bool ViewerHasWriteAccess,
    string CustomId,
    int Version,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    ItemUserResult? CreatedBy,
    ItemUserResult? UpdatedBy,
    int LikeCount,
    bool LikedByViewer,
    IReadOnlyList<ItemDetailsFieldAggregate> Fields);

public sealed record ItemDetailsFieldAggregate(
    long FieldId,
    CustomFieldType FieldType,
    string Title,
    string Description,
    object? Value);
