namespace backend.Modules.Items.UseCases.CreateItem;

public interface ICreateItemUseCase
{
    Task<ItemResult> ExecuteAsync(
        CreateItemCommand command,
        CancellationToken cancellationToken);
}
