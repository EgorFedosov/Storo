namespace backend.Modules.Inventories.UseCases.EditorMutations;

public interface IReplaceInventoryTagsUseCase
{
    Task<InventoryVersionResult> ExecuteAsync(
        ReplaceInventoryTagsCommand command,
        CancellationToken cancellationToken);
}
