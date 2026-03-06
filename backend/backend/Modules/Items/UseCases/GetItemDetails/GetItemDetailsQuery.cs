using backend.Modules.Items.UseCases.ItemLifecycle;

namespace backend.Modules.Items.UseCases.GetItemDetails;

public sealed record GetItemDetailsQuery(
    long ItemId,
    ItemViewerContext ViewerContext);
