using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Inventories.Domain;
using backend.Modules.Inventories.UseCases.Abstractions;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;

namespace backend.Modules.Inventories.UseCases.CreateInventory;

public sealed class CreateInventoryUseCase(
    IInventoryRepository inventoryRepository,
    ITagService tagService,
    IUnitOfWork unitOfWork) : ICreateInventoryUseCase
{
    public async Task<InventoryDetailsResult> ExecuteAsync(
        CreateInventoryCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        if (!await inventoryRepository.CategoryExistsAsync(command.CategoryId, cancellationToken))
        {
            throw new InventoryCategoryNotFoundException(command.CategoryId);
        }

        var now = DateTime.UtcNow;
        var inventory = new Inventory
        {
            CreatorId = command.CreatorUserId,
            CategoryId = command.CategoryId,
            Title = command.Title,
            DescriptionMarkdown = command.DescriptionMarkdown,
            ImageUrl = command.ImageUrl,
            IsPublic = command.IsPublic,
            Version = 1,
            CreatedAt = now,
            UpdatedAt = now
        };

        await inventoryRepository.AddAsync(inventory, cancellationToken);

        var tags = await tagService.ResolveTagsAsync(command.Tags, cancellationToken);
        foreach (var tag in tags)
        {
            inventory.InventoryTags.Add(new InventoryTag
            {
                Inventory = inventory,
                Tag = tag
            });
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);

        var aggregate = await inventoryRepository.GetDetailsAsync(
            inventory.Id,
            command.CreatorUserId,
            cancellationToken);

        if (aggregate is null)
        {
            throw new InvalidOperationException(
                $"Created inventory '{inventory.Id}' could not be loaded after persistence.");
        }

        var creatorContext = new InventoryViewerContext(
            command.CreatorUserId,
            true,
            false,
            false);

        return InventoryDetailsResultFactory.Create(aggregate, creatorContext);
    }
}
