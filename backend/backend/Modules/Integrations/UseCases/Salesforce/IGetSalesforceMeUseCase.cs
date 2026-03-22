namespace backend.Modules.Integrations.UseCases.Salesforce;

public interface IGetSalesforceMeUseCase
{
    Task<SalesforceMeResult> ExecuteAsync(
        GetSalesforceMeQuery query,
        CancellationToken cancellationToken);
}
