using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Inventories.Domain;
using backend.Modules.Inventories.UseCases.Abstractions;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;

namespace backend.Modules.Inventories.UseCases.EditorMutations;

public sealed class ReplaceInventoryAccessUseCase(
    IInventoryRepository inventoryRepository,
    IAccessService accessService,
    IVersionedCommandUseCase versionedCommandUseCase) : IReplaceInventoryAccessUseCase
{
    public async Task<InventoryVersionResult> ExecuteAsync(
        ReplaceInventoryAccessCommand command,
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

        var normalizedWriterUserIds = command.WriterUserIds
            .Where(id => id > 0 && id != inventory.CreatorId)
            .Distinct()
            .ToArray();

        var existingWriterUserIds = await accessService.ResolveExistingWriterIdsAsync(
            normalizedWriterUserIds,
            cancellationToken);

        var existingWriterUserIdSet = existingWriterUserIds.ToHashSet();
        var missingUserIds = normalizedWriterUserIds
            .Where(id => !existingWriterUserIdSet.Contains(id))
            .OrderBy(id => id)
            .ToArray();

        if (missingUserIds.Length > 0)
        {
            throw new InventoryAccessUsersNotFoundException(missingUserIds);
        }

        var now = DateTime.UtcNow;
        var desiredWriterUserIdSet = normalizedWriterUserIds.ToHashSet();

        foreach (var staleEntry in inventory.AccessList
                     .Where(entry => !desiredWriterUserIdSet.Contains(entry.UserId))
                     .ToArray())
        {
            inventory.AccessList.Remove(staleEntry);
        }

        var existingAccessUserIdSet = inventory.AccessList
            .Select(entry => entry.UserId)
            .ToHashSet();

        foreach (var writerUserId in normalizedWriterUserIds
                     .Where(id => !existingAccessUserIdSet.Contains(id)))
        {
            inventory.AccessList.Add(new InventoryAccess
            {
                InventoryId = inventory.Id,
                UserId = writerUserId,
                GrantedByUserId = command.ActorUserId,
                CreatedAt = now
            });
        }

        inventory.IsPublic = command.Mode == InventoryAccessMode.Public;

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
