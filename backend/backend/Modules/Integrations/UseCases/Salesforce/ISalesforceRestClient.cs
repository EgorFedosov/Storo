namespace backend.Modules.Integrations.UseCases.Salesforce;

public interface ISalesforceRestClient
{
    Task<SalesforceCreateAccountResult> CreateAccountAsync(
        SalesforceCreateAccountRequest request,
        CancellationToken cancellationToken);

    Task<SalesforceCreateContactResult> CreateContactAsync(
        SalesforceCreateContactRequest request,
        CancellationToken cancellationToken);
}

public sealed record SalesforceCreateAccountRequest(
    string AccessToken,
    string CompanyName);

public sealed record SalesforceCreateAccountResult(
    string SfAccountId);

public sealed record SalesforceCreateContactRequest(
    string AccessToken,
    string AccountId,
    string LastName,
    string? Email,
    string? Phone,
    string? JobTitle,
    string? Country,
    string? Notes);

public sealed record SalesforceCreateContactResult(
    string SfContactId);
