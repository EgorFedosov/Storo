namespace backend.Modules.Inventories.UseCases.Discussion;

public interface ICreateDiscussionPostUseCase
{
    Task<DiscussionPostResult> ExecuteAsync(
        CreateDiscussionPostCommand command,
        CancellationToken cancellationToken);
}
