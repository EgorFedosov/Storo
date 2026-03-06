using backend.Modules.Items.UseCases.CreateItem;

namespace backend.Modules.Items.UseCases.GetItemDetails;

public interface IGetItemDetailsUseCase
{
    Task<ItemResult> ExecuteAsync(
        GetItemDetailsQuery query,
        CancellationToken cancellationToken);
}
