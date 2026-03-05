using backend.Modules.Inventories.Domain;

namespace backend.Modules.Inventories.UseCases.EditorMutations;

internal static class InventoryEditorMutationAuthorization
{
    public static void EnsureCanEdit(Inventory inventory, long actorUserId, bool actorIsAdmin)
    {
        ArgumentNullException.ThrowIfNull(inventory);

        if (!actorIsAdmin && inventory.CreatorId != actorUserId)
        {
            throw new InventoryEditorMutationAccessDeniedException(inventory.Id, actorUserId);
        }
    }
}
