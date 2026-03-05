namespace backend.Modules.Inventories.UseCases.CustomIdTemplate;

public interface ISequenceStateRepository
{
    Task<long?> GetLastValueAsync(long inventoryId, CancellationToken cancellationToken);
}
