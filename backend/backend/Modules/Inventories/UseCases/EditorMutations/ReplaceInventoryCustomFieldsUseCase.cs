using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Inventories.UseCases.Abstractions;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;

namespace backend.Modules.Inventories.UseCases.EditorMutations;

public sealed class ReplaceInventoryCustomFieldsUseCase(
    IInventoryRepository inventoryRepository,
    ICustomFieldService customFieldService,
    IVersionedCommandUseCase versionedCommandUseCase) : IReplaceInventoryCustomFieldsUseCase
{
    public async Task<InventoryVersionResult> ExecuteAsync(
        ReplaceInventoryCustomFieldsCommand command,
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

        var now = DateTime.UtcNow;
        var activeFields = customFieldService.Replace(inventory, command.Fields, now);

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
            activeFields
                .OrderBy(field => field.SortOrder)
                .ThenBy(field => field.Id)
                .Select(field => new InventoryVersionCustomFieldResult(
                    field.Id,
                    field.FieldType,
                    field.Title,
                    field.Description,
                    field.ShowInTable))
                .ToArray());
    }
}
