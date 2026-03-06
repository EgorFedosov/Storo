using backend.Modules.Items.UseCases.CreateItem;

namespace backend.Modules.Items.UseCases.ItemLifecycle;

public static class ItemDetailsResultFactory
{
    public static ItemResult Create(
        ItemDetailsAggregate aggregate,
        ItemViewerContext viewerContext)
    {
        ArgumentNullException.ThrowIfNull(aggregate);
        ArgumentNullException.ThrowIfNull(viewerContext);

        var isActiveViewer = viewerContext.IsAuthenticated && !viewerContext.IsBlocked;
        var isCreator = viewerContext.UserId.HasValue && viewerContext.UserId.Value == aggregate.InventoryCreatorId;
        var canWriteItems = isActiveViewer
                            && (viewerContext.IsAdmin
                                || isCreator
                                || aggregate.InventoryIsPublic
                                || aggregate.ViewerHasWriteAccess);

        return new ItemResult(
            aggregate.Id,
            new ItemInventoryResult(aggregate.InventoryId, aggregate.InventoryTitle),
            aggregate.CustomId,
            aggregate.Version,
            new ItemFixedFieldsResult(
                aggregate.CreatedAt,
                aggregate.UpdatedAt,
                aggregate.CreatedBy,
                aggregate.UpdatedBy),
            aggregate.Fields.Select(field => new ItemFieldResult(
                    field.FieldId,
                    field.FieldType,
                    field.Title,
                    field.Description,
                    field.Value))
                .ToArray(),
            new ItemLikeResult(aggregate.LikeCount, aggregate.LikedByViewer),
            new ItemPermissionsResult(
                CanEdit: canWriteItems,
                CanDelete: canWriteItems,
                CanLike: isActiveViewer));
    }
}
