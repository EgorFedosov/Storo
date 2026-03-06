using backend.Modules.Inventories.Domain;

namespace backend.Modules.Items.UseCases.CreateItem;

public interface ICustomIdGenerationService
{
    string ResolveCustomId(
        Inventory inventory,
        string? requestedCustomId,
        DateTime nowUtc);
}
