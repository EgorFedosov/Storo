namespace backend.Modules.Items.UseCases.DeleteItem;

public interface IDeleteItemUseCase
{
    Task<DeleteItemResult> ExecuteAsync(
        DeleteItemCommand command,
        CancellationToken cancellationToken);
}
