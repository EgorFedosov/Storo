using backend.Modules.Inventories.Domain;

namespace backend.Modules.Inventories.UseCases.Abstractions;

public interface IInventoryRepository
{
    Task<bool> CategoryExistsAsync(int categoryId, CancellationToken cancellationToken);

    Task AddAsync(Inventory inventory, CancellationToken cancellationToken);

    Task<InventoryDetailsAggregate?> GetDetailsAsync(
        long inventoryId,
        long? viewerUserId,
        CancellationToken cancellationToken);
}

public sealed record InventoryDetailsAggregate(
    long Id,
    int Version,
    string Title,
    string DescriptionMarkdown,
    int CategoryId,
    string CategoryName,
    string? ImageUrl,
    bool IsPublic,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    long CreatorId,
    string CreatorUserName,
    string CreatorDisplayName,
    int ItemsCount,
    bool ViewerHasWriteAccess,
    IReadOnlyList<InventoryTagAggregate> Tags);

public sealed record InventoryTagAggregate(long Id, string Name);
