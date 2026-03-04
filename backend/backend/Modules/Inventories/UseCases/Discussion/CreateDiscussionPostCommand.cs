namespace backend.Modules.Inventories.UseCases.Discussion;

public sealed record CreateDiscussionPostCommand(
    long InventoryId,
    long AuthorUserId,
    string ContentMarkdown);
