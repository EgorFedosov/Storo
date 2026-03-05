namespace backend.Modules.Inventories.UseCases.DeleteInventory;

public readonly record struct DeleteInventoryResult
{
    public static DeleteInventoryResult Deleted { get; } = new();
}
