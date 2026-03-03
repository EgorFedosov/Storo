namespace backend.Modules.Users.UseCases.ListCurrentUserInventories;

public interface IListCurrentUserInventoriesUseCase
{
    Task<InventoryTableResult> ExecuteAsync(ListCurrentUserInventoriesQuery query, CancellationToken cancellationToken);
}
