using backend.Modules.Inventories.UseCases.Discussion;

namespace backend.Modules.Inventories.UseCases.Abstractions;

public interface IDiscussionHubPublisher
{
    Task PublishPostedAsync(DiscussionPostedEvent discussionEvent, CancellationToken cancellationToken);
}
