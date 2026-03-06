using backend.Modules.Items.UseCases.CreateItem;
using backend.Modules.Items.UseCases.ItemLifecycle;

namespace backend.Modules.Items.UseCases.GetItemDetails;

public sealed class GetItemDetailsUseCase(IItemRepository itemRepository) : IGetItemDetailsUseCase
{
    public async Task<ItemResult> ExecuteAsync(
        GetItemDetailsQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var aggregate = await itemRepository.GetDetailsAsync(
            query.ItemId,
            query.ViewerContext.UserId,
            cancellationToken);

        if (aggregate is null)
        {
            throw new ItemNotFoundException(query.ItemId);
        }

        return ItemDetailsResultFactory.Create(aggregate, query.ViewerContext);
    }
}
