using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Items.UseCases.CreateItem;

namespace backend.Modules.Items.UseCases.UpdateItem;

public sealed record UpdateItemCommand(
    long ItemId,
    long ActorUserId,
    bool ActorIsAdmin,
    IfMatchToken IfMatchToken,
    string CustomId,
    IReadOnlyList<CreateItemFieldInput> Fields);
