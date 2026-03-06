using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Items.Domain;
using backend.Modules.Items.UseCases.ItemLifecycle;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace backend.Modules.Items.UseCases.Likes;

public sealed class SetItemLikeUseCase(
    IItemLikeRepository itemLikeRepository,
    IUnitOfWork unitOfWork) : ISetItemLikeUseCase
{
    private const string ItemLikePrimaryKeyConstraintName = "PK_item_likes";
    private const string ItemLikeItemForeignKeyConstraintName = "FK_item_likes_items_item_id";

    public async Task<ItemLikeStateResult> ExecuteAsync(
        SetItemLikeCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        if (!await itemLikeRepository.ItemExistsAsync(command.ItemId, cancellationToken))
        {
            throw new ItemNotFoundException(command.ItemId);
        }

        if (!await itemLikeRepository.HasLikeAsync(command.ItemId, command.ActorUserId, cancellationToken))
        {
            await itemLikeRepository.AddLikeAsync(
                new ItemLike
                {
                    ItemId = command.ItemId,
                    UserId = command.ActorUserId,
                    CreatedAt = DateTime.UtcNow
                },
                cancellationToken);

            try
            {
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException exception) when (IsDuplicateLikeConstraintViolation(exception))
            {
                // Idempotent PUT: concurrent duplicate insert for the same (itemId, userId) is acceptable.
            }
            catch (DbUpdateException exception) when (IsMissingItemConstraintViolation(exception))
            {
                throw new ItemNotFoundException(command.ItemId);
            }
        }

        var state = await itemLikeRepository.GetLikeStateAsync(command.ItemId, command.ActorUserId, cancellationToken);
        if (state is null)
        {
            throw new ItemNotFoundException(command.ItemId);
        }

        return new ItemLikeStateResult(state.ItemId, state.Count, state.LikedByCurrentUser);
    }

    private static bool IsDuplicateLikeConstraintViolation(DbUpdateException exception)
    {
        if (exception.InnerException is not PostgresException postgresException)
        {
            return false;
        }

        return postgresException.SqlState == PostgresErrorCodes.UniqueViolation
               && string.Equals(
                   postgresException.ConstraintName,
                   ItemLikePrimaryKeyConstraintName,
                   StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsMissingItemConstraintViolation(DbUpdateException exception)
    {
        if (exception.InnerException is not PostgresException postgresException)
        {
            return false;
        }

        return postgresException.SqlState == PostgresErrorCodes.ForeignKeyViolation
               && string.Equals(
                   postgresException.ConstraintName,
                   ItemLikeItemForeignKeyConstraintName,
                   StringComparison.OrdinalIgnoreCase);
    }
}
