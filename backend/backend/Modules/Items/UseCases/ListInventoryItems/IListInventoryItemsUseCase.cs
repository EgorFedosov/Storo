namespace backend.Modules.Items.UseCases.ListInventoryItems;

public interface IListInventoryItemsUseCase
{
    Task<ItemsTableResult> ExecuteAsync(
        ListInventoryItemsQuery query,
        CancellationToken cancellationToken);
}
