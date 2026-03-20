namespace backend.Modules.Integrations.UseCases.Salesforce;

public interface ISalesforceAccessTokenClient
{
    Task<SalesforceAccessTokenResult> GetAccessTokenAsync(CancellationToken cancellationToken);
}

public sealed record SalesforceAccessTokenResult(
    string AccessToken,
    string TokenType);
