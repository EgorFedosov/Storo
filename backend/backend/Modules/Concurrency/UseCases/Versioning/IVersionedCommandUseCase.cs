namespace backend.Modules.Concurrency.UseCases.Versioning;

public interface IVersionedCommandUseCase
{
    Task<VersionedResult> ExecuteAsync(
        VersionedCommand command,
        int currentVersion,
        Action<int> applyNextVersion,
        CancellationToken cancellationToken);
}
