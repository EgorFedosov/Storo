using backend.Modules.Inventories.UseCases.Abstractions;

namespace backend.Modules.Inventories.UseCases.GetInventoryDetails;

public static class InventoryDetailsResultFactory
{
    public static InventoryDetailsResult Create(
        InventoryDetailsAggregate aggregate,
        InventoryViewerContext viewerContext)
    {
        ArgumentNullException.ThrowIfNull(aggregate);
        ArgumentNullException.ThrowIfNull(viewerContext);

        var isActiveViewer = viewerContext.IsAuthenticated && !viewerContext.IsBlocked;
        var isCreator = viewerContext.UserId.HasValue && viewerContext.UserId.Value == aggregate.CreatorId;
        var isAdmin = isActiveViewer && viewerContext.IsAdmin;

        var canManageInventory = isActiveViewer && (isCreator || isAdmin);
        var canWriteItems = isActiveViewer
                            && (isCreator
                                || isAdmin
                                || aggregate.IsPublic
                                || aggregate.ViewerHasWriteAccess);

        return new InventoryDetailsResult(
            aggregate.Id,
            aggregate.Version,
            new InventoryHeaderResult(
                aggregate.Title,
                aggregate.DescriptionMarkdown,
                new InventoryCategoryResult(aggregate.CategoryId, aggregate.CategoryName),
                aggregate.ImageUrl,
                aggregate.IsPublic,
                aggregate.CreatedAt,
                aggregate.UpdatedAt),
            new InventoryCreatorResult(
                aggregate.CreatorId,
                aggregate.CreatorUserName,
                aggregate.CreatorDisplayName),
            aggregate.Tags.Select(tag => new InventoryTagResult(tag.Id, tag.Name)).ToArray(),
            new InventorySummaryResult(aggregate.ItemsCount),
            new InventoryPermissionsResult(
                canManageInventory,
                canManageInventory,
                canManageInventory,
                canManageInventory,
                canWriteItems,
                isActiveViewer,
                isActiveViewer));
    }
}
