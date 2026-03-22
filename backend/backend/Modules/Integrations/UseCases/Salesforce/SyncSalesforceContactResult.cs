namespace backend.Modules.Integrations.UseCases.Salesforce;

public sealed record SyncSalesforceContactResult(
    string SyncStatus,
    string? SfAccountId,
    string? SfContactId,
    DateTime SyncedAtUtc,
    string? ErrorMessage);
