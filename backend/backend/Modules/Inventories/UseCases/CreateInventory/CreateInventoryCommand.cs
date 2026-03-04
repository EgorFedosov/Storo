namespace backend.Modules.Inventories.UseCases.CreateInventory;

public sealed record CreateInventoryCommand(
    long CreatorUserId,
    string Title,
    int CategoryId,
    string DescriptionMarkdown,
    string? ImageUrl,
    bool IsPublic,
    IReadOnlyCollection<string> Tags);
