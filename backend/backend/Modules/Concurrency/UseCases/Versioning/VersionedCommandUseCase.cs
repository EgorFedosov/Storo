namespace backend.Modules.Concurrency.UseCases.Versioning;

public sealed class VersionedCommandUseCase(
    IETagService eTagService,
    IUnitOfWork unitOfWork) : IVersionedCommandUseCase
{
    public async Task<VersionedResult> ExecuteAsync(
        VersionedCommand command,
        int currentVersion,
        Action<int> applyNextVersion,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(applyNextVersion);

        if (currentVersion <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(currentVersion), "Current version must be greater than zero.");
        }

        if (!eTagService.IsMatch(command.IfMatchToken, currentVersion))
        {
            throw new ConcurrencyConflictException(command.IfMatchToken.Version, currentVersion);
        }

        var nextVersion = checked(currentVersion + 1);
        applyNextVersion(nextVersion);

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new VersionedResult(nextVersion, eTagService.ToETag(nextVersion));
    }
}
