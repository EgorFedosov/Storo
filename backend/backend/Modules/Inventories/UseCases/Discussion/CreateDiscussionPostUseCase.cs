using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Inventories.Domain;
using backend.Modules.Inventories.UseCases.Abstractions;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;

namespace backend.Modules.Inventories.UseCases.Discussion;

public sealed class CreateDiscussionPostUseCase(
    IDiscussionRepository discussionRepository,
    IDiscussionHubPublisher discussionHubPublisher,
    IUnitOfWork unitOfWork) : ICreateDiscussionPostUseCase
{
    public async Task<DiscussionPostResult> ExecuteAsync(
        CreateDiscussionPostCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        if (!await discussionRepository.InventoryExistsAsync(command.InventoryId, cancellationToken))
        {
            throw new InventoryNotFoundException(command.InventoryId);
        }

        var post = new DiscussionPost
        {
            InventoryId = command.InventoryId,
            AuthorUserId = command.AuthorUserId,
            ContentMarkdown = command.ContentMarkdown,
            CreatedAt = DateTime.UtcNow
        };

        await discussionRepository.AddPostAsync(post, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        var aggregate = await discussionRepository.GetPostByIdAsync(post.Id, cancellationToken);
        if (aggregate is null)
        {
            throw new InvalidOperationException(
                $"Created discussion post '{post.Id}' could not be loaded after persistence.");
        }

        var result = new DiscussionPostResult(
            aggregate.Id,
            aggregate.InventoryId,
            aggregate.ContentMarkdown,
            aggregate.CreatedAt,
            new DiscussionPostAuthorResult(
                aggregate.AuthorId,
                aggregate.AuthorUserName,
                aggregate.AuthorDisplayName));

        await discussionHubPublisher.PublishPostedAsync(
            DiscussionPostedEvent.Create(result),
            cancellationToken);

        return result;
    }
}
