namespace backend.Modules.Integrations.UseCases.Salesforce;

public interface ISyncSalesforceContactUseCase
{
    Task<SyncSalesforceContactResult> ExecuteAsync(
        SyncSalesforceContactCommand command,
        CancellationToken cancellationToken);
}
