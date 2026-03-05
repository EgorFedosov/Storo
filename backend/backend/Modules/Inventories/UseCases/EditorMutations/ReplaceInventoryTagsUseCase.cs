using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Inventories.Domain;
using backend.Modules.Inventories.UseCases.Abstractions;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;

namespace backend.Modules.Inventories.UseCases.EditorMutations;

public sealed class ReplaceInventoryTagsUseCase(
    IInventoryRepository inventoryRepository,
    ITagService tagService,
    IVersionedCommandUseCase versionedCommandUseCase) : IReplaceInventoryTagsUseCase
{
    public async Task<InventoryVersionResult> ExecuteAsync(
        ReplaceInventoryTagsCommand command,
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

        var resolvedTags = await tagService.ResolveTagsAsync(command.Tags, cancellationToken);
        var desiredByNormalizedName = resolvedTags.ToDictionary(
            tag => tag.NormalizedName,
            tag => tag,
            StringComparer.Ordinal);

        var existingEntriesByNormalizedName = inventory.InventoryTags
            .ToDictionary(entry => entry.Tag.NormalizedName, entry => entry, StringComparer.Ordinal);

        foreach (var existingEntry in existingEntriesByNormalizedName.Values
                     .Where(entry => !desiredByNormalizedName.ContainsKey(entry.Tag.NormalizedName))
                     .ToArray())
        {
            inventory.InventoryTags.Remove(existingEntry);
        }

        foreach (var desiredTag in desiredByNormalizedName.Values
                     .Where(tag => !existingEntriesByNormalizedName.ContainsKey(tag.NormalizedName)))
        {
            inventory.InventoryTags.Add(new InventoryTag
            {
                Inventory = inventory,
                Tag = desiredTag
            });
        }

        var now = DateTime.UtcNow;
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
