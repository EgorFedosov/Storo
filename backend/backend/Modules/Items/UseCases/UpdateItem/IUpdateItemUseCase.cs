using backend.Modules.Items.UseCases.CreateItem;

namespace backend.Modules.Items.UseCases.UpdateItem;

public interface IUpdateItemUseCase
{
    Task<ItemResult> ExecuteAsync(
        UpdateItemCommand command,
        CancellationToken cancellationToken);
}
