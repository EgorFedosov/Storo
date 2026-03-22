namespace backend.Modules.Integrations.UseCases.Salesforce;

public sealed record SalesforceMeResult(
    bool IsLinked,
    string? SfAccountId,
    string? SfContactId,
    string LastSyncStatus,
    DateTime? LastSyncedAtUtc);
