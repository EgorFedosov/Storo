using backend.Modules.Integrations.Domain;

namespace backend.Modules.Integrations.UseCases.Salesforce;

public interface ISalesforceContactRepository
{
    Task<SalesforceContact?> GetByUserIdAsync(
        long userId,
        CancellationToken cancellationToken);

    Task<SalesforceContact> UpsertAsync(
        long userId,
        string syncStatus,
        string? sfAccountId,
        string? sfContactId,
        DateTime? lastSyncAtUtc,
        string? lastError,
        CancellationToken cancellationToken);
}
