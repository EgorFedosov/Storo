namespace backend.Modules.Inventories.UseCases.EditorMutations;

public interface IReplaceInventoryCustomFieldsUseCase
{
    Task<InventoryVersionResult> ExecuteAsync(
        ReplaceInventoryCustomFieldsCommand command,
        CancellationToken cancellationToken);
}
