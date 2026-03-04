using backend.Modules.Inventories.UseCases.GetInventoryDetails;

namespace backend.Modules.Inventories.UseCases.GetInventoryEditor;

public sealed class GetInventoryEditorUseCase(IInventoryEditorReadModel editorReadModel) : IGetInventoryEditorUseCase
{
    public async Task<InventoryEditorResult> ExecuteAsync(
        GetInventoryEditorQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var aggregate = await editorReadModel.GetAsync(query.InventoryId, cancellationToken);
        if (aggregate is null)
        {
            throw new InventoryNotFoundException(query.InventoryId);
        }

        if (!query.ViewerIsAdmin && aggregate.CreatorId != query.ViewerUserId)
        {
            throw new InventoryEditorAccessDeniedException(query.InventoryId, query.ViewerUserId);
        }

        return InventoryEditorResultFactory.Create(aggregate);
    }
}
