namespace backend.Modules.Items.UseCases.Likes;

public interface IRemoveItemLikeUseCase
{
    Task<ItemLikeStateResult> ExecuteAsync(
        RemoveItemLikeCommand command,
        CancellationToken cancellationToken);
}
