namespace backend.Modules.Integrations.UseCases.Salesforce;

public sealed record SyncSalesforceContactCommand(
    string CompanyName,
    string? JobTitle,
    string? Phone,
    string? Country,
    string? Notes,
    long ActorUserId,
    string? ActorEmail,
    string? ActorDisplayName);
