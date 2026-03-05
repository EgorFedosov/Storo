namespace backend.Modules.Inventories.UseCases.Abstractions;

public interface IAccessService
{
    Task<IReadOnlyCollection<long>> ResolveExistingWriterIdsAsync(
        IReadOnlyCollection<long> candidateUserIds,
        CancellationToken cancellationToken);
}
