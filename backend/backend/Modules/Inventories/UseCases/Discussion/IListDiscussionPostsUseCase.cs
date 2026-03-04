namespace backend.Modules.Inventories.UseCases.Discussion;

public interface IListDiscussionPostsUseCase
{
    Task<DiscussionPostsPageResult> ExecuteAsync(
        ListDiscussionPostsQuery query,
        CancellationToken cancellationToken);
}
