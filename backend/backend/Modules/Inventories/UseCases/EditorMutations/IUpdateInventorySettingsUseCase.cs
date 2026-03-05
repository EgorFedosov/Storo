namespace backend.Modules.Inventories.UseCases.EditorMutations;

public interface IUpdateInventorySettingsUseCase
{
    Task<InventoryVersionResult> ExecuteAsync(
        UpdateInventorySettingsCommand command,
        CancellationToken cancellationToken);
}
