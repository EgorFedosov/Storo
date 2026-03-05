namespace backend.Modules.Items.UseCases.ListInventoryItems;

public sealed class ListInventoryItemsUseCase(IItemsTableReadModel itemsTableReadModel) : IListInventoryItemsUseCase
{
    public async Task<ItemsTableResult> ExecuteAsync(
        ListInventoryItemsQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var result = await itemsTableReadModel.ListAsync(
            new ListInventoryItemsReadModelQuery(
                query.InventoryId,
                query.Page,
                query.PageSize,
                query.SortField,
                query.SortDirection,
                query.ViewerUserId),
            cancellationToken);

        if (result is null)
        {
            throw new InventoryItemsInventoryNotFoundException(query.InventoryId);
        }

        return result;
    }
}
