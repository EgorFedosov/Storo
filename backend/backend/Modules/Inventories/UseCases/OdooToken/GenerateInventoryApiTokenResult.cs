namespace backend.Modules.Inventories.UseCases.OdooToken;

public sealed record GenerateInventoryApiTokenResult(
    long InventoryId,
    string PlainToken,
    string MaskedToken,
    DateTime CreatedAt);
