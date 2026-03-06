namespace backend.Modules.Items.UseCases.ItemLifecycle;

public sealed record ItemViewerContext(
    long? UserId,
    bool IsAuthenticated,
    bool IsBlocked,
    bool IsAdmin);
