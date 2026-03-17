using backend.Modules.Inventories.Domain;

namespace backend.Modules.Inventories.UseCases.OdooToken;

public interface IInventoryApiTokenRepository
{
    Task<InventoryApiToken?> GetActiveForUpdateAsync(
        long inventoryId,
        CancellationToken cancellationToken);

    Task<InventoryApiToken?> GetActiveByHashAsync(
        string tokenHash,
        CancellationToken cancellationToken);

    Task AddAsync(
        InventoryApiToken token,
        CancellationToken cancellationToken);
}
