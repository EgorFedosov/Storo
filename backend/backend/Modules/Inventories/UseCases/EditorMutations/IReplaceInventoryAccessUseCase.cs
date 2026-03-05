namespace backend.Modules.Inventories.UseCases.EditorMutations;

public interface IReplaceInventoryAccessUseCase
{
    Task<InventoryVersionResult> ExecuteAsync(
        ReplaceInventoryAccessCommand command,
        CancellationToken cancellationToken);
}
