using System.Globalization;
using backend.Modules.Inventories.UseCases.Abstractions;
using backend.Modules.Inventories.UseCases.Discussion;
using Microsoft.AspNetCore.SignalR;

namespace backend.Modules.Inventories.Infrastructure.Realtime;

public sealed class SignalRDiscussionHubPublisher(IHubContext<DiscussionHub> hubContext) : IDiscussionHubPublisher
{
    public Task PublishPostedAsync(DiscussionPostedEvent discussionEvent, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(discussionEvent);

        var payload = new DiscussionPostedHubPayload(
            discussionEvent.Event,
            discussionEvent.InventoryId.ToString(CultureInfo.InvariantCulture),
            new DiscussionPostedPostPayload(
                discussionEvent.Post.Id.ToString(CultureInfo.InvariantCulture),
                discussionEvent.Post.ContentMarkdown,
                discussionEvent.Post.CreatedAt,
                new DiscussionPostedAuthorPayload(
                    discussionEvent.Post.Author.Id.ToString(CultureInfo.InvariantCulture),
                    discussionEvent.Post.Author.UserName,
                    discussionEvent.Post.Author.DisplayName)));

        return hubContext.Clients
            .Group(DiscussionHub.GroupName(discussionEvent.InventoryId))
            .SendAsync(DiscussionPostedEvent.PostedEventName, payload, cancellationToken);
    }
}

internal sealed record DiscussionPostedHubPayload(
    string Event,
    string InventoryId,
    DiscussionPostedPostPayload Post);

internal sealed record DiscussionPostedPostPayload(
    string Id,
    string ContentMarkdown,
    DateTime CreatedAt,
    DiscussionPostedAuthorPayload Author);

internal sealed record DiscussionPostedAuthorPayload(
    string Id,
    string UserName,
    string DisplayName);
