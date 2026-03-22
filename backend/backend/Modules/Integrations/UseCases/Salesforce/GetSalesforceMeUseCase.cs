namespace backend.Modules.Integrations.UseCases.Salesforce;

public sealed class GetSalesforceMeUseCase(
    ISalesforceContactRepository salesforceContactRepository) : IGetSalesforceMeUseCase
{
    private const string SyncedStatus = "Synced";
    private const string FailedStatus = "Failed";
    private const string NeverStatus = "Never";

    public async Task<SalesforceMeResult> ExecuteAsync(
        GetSalesforceMeQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        if (query.ActorUserId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(query.ActorUserId), "Actor user id must be positive.");
        }

        var contact = await salesforceContactRepository.GetByUserIdAsync(query.ActorUserId, cancellationToken);
        if (contact is null)
        {
            return new SalesforceMeResult(
                IsLinked: false,
                SfAccountId: null,
                SfContactId: null,
                LastSyncStatus: NeverStatus,
                LastSyncedAtUtc: null);
        }

        var sfAccountId = NormalizeOptional(contact.SfAccountId);
        var sfContactId = NormalizeOptional(contact.SfContactId);
        var lastSyncStatus = NormalizeSyncStatus(contact.SyncStatus);
        var isLinked = !string.IsNullOrWhiteSpace(sfAccountId)
                       && !string.IsNullOrWhiteSpace(sfContactId);

        return new SalesforceMeResult(
            IsLinked: isLinked,
            SfAccountId: sfAccountId,
            SfContactId: sfContactId,
            LastSyncStatus: lastSyncStatus,
            LastSyncedAtUtc: contact.LastSyncAtUtc);
    }

    private static string NormalizeSyncStatus(string? syncStatus)
    {
        if (string.IsNullOrWhiteSpace(syncStatus))
        {
            return NeverStatus;
        }

        return syncStatus.Trim().ToLowerInvariant() switch
        {
            "synced" => SyncedStatus,
            "failed" => FailedStatus,
            _ => FailedStatus
        };
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }
}
