using backend.Modules.Concurrency.UseCases.Versioning;

namespace backend.Modules.Items.UseCases.DeleteItem;

public sealed record DeleteItemCommand(
    long ItemId,
    long ActorUserId,
    bool ActorIsAdmin,
    IfMatchToken IfMatchToken);
