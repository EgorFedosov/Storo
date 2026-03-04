namespace backend.Modules.Inventories.UseCases.GetInventoryEditor;

public interface IGetInventoryEditorUseCase
{
    Task<InventoryEditorResult> ExecuteAsync(
        GetInventoryEditorQuery query,
        CancellationToken cancellationToken);
}
