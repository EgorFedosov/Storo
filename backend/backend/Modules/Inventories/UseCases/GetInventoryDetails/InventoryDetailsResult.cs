namespace backend.Modules.Inventories.UseCases.GetInventoryDetails;

public sealed record InventoryDetailsResult(
    long Id,
    int Version,
    InventoryHeaderResult Header,
    InventoryCreatorResult Creator,
    IReadOnlyList<InventoryTagResult> Tags,
    InventorySummaryResult Summary,
    InventoryPermissionsResult Permissions);

public sealed record InventoryHeaderResult(
    string Title,
    string DescriptionMarkdown,
    InventoryCategoryResult Category,
    string? ImageUrl,
    bool IsPublic,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record InventoryCategoryResult(int Id, string Name);

public sealed record InventoryCreatorResult(long Id, string UserName, string DisplayName);

public sealed record InventoryTagResult(long Id, string Name);

public sealed record InventorySummaryResult(int ItemsCount);

public sealed record InventoryPermissionsResult(
    bool CanEditInventory,
    bool CanManageAccess,
    bool CanManageCustomFields,
    bool CanManageCustomIdTemplate,
    bool CanWriteItems,
    bool CanComment,
    bool CanLike);

public sealed record InventoryViewerContext(
    long? UserId,
    bool IsAuthenticated,
    bool IsBlocked,
    bool IsAdmin);
