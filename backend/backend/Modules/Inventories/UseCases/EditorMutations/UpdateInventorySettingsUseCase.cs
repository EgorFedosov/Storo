using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Inventories.UseCases.Abstractions;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;

namespace backend.Modules.Inventories.UseCases.EditorMutations;

public sealed class UpdateInventorySettingsUseCase(
    IInventoryRepository inventoryRepository,
    IVersionedCommandUseCase versionedCommandUseCase) : IUpdateInventorySettingsUseCase
{
    public async Task<InventoryVersionResult> ExecuteAsync(
        UpdateInventorySettingsCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        var inventory = await inventoryRepository.GetForUpdateAsync(command.InventoryId, cancellationToken);
        if (inventory is null)
        {
            throw new InventoryNotFoundException(command.InventoryId);
        }

        InventoryEditorMutationAuthorization.EnsureCanEdit(inventory, command.ActorUserId, command.ActorIsAdmin);

        if (!await inventoryRepository.CategoryExistsAsync(command.CategoryId, cancellationToken))
        {
            throw new InventoryCategoryNotFoundException(command.CategoryId);
        }

        var now = DateTime.UtcNow;
        inventory.Title = command.Title;
        inventory.DescriptionMarkdown = command.DescriptionMarkdown;
        inventory.CategoryId = command.CategoryId;
        inventory.ImageUrl = command.ImageUrl;

        var versionedResult = await versionedCommandUseCase.ExecuteAsync(
            new VersionedCommand(command.IfMatchToken),
            inventory.Version,
            nextVersion =>
            {
                inventory.Version = nextVersion;
                inventory.UpdatedAt = now;
            },
            cancellationToken);

        return new InventoryVersionResult(
            versionedResult.Version,
            Array.Empty<InventoryVersionCustomFieldResult>());
    }
}
