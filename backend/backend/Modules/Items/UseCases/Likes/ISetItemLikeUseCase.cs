namespace backend.Modules.Items.UseCases.Likes;

public interface ISetItemLikeUseCase
{
    Task<ItemLikeStateResult> ExecuteAsync(
        SetItemLikeCommand command,
        CancellationToken cancellationToken);
}
