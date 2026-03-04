namespace backend.Modules.Inventories.UseCases.Discussion;

public sealed record ListDiscussionPostsQuery(
    long InventoryId,
    long? AfterId,
    long? BeforeId,
    int Limit);
