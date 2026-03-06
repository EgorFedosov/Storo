using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Items.UseCases.ItemLifecycle;

namespace backend.Modules.Items.UseCases.Likes;

public sealed class RemoveItemLikeUseCase(
    IItemLikeRepository itemLikeRepository,
    IUnitOfWork unitOfWork) : IRemoveItemLikeUseCase
{
    public async Task<ItemLikeStateResult> ExecuteAsync(
        RemoveItemLikeCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        if (!await itemLikeRepository.ItemExistsAsync(command.ItemId, cancellationToken))
        {
            throw new ItemNotFoundException(command.ItemId);
        }

        var like = await itemLikeRepository.GetLikeAsync(command.ItemId, command.ActorUserId, cancellationToken);
        if (like is not null)
        {
            itemLikeRepository.RemoveLike(like);

            try
            {
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
            catch (ConcurrencyConflictException)
            {
                // Idempotent DELETE: concurrent removal of the same like should not fail the request.
            }
        }

        var state = await itemLikeRepository.GetLikeStateAsync(command.ItemId, command.ActorUserId, cancellationToken);
        if (state is null)
        {
            throw new ItemNotFoundException(command.ItemId);
        }

        return new ItemLikeStateResult(state.ItemId, state.Count, state.LikedByCurrentUser);
    }
}
