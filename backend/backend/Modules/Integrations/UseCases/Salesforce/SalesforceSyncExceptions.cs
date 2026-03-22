namespace backend.Modules.Integrations.UseCases.Salesforce;

public sealed class SalesforceSyncUpstreamException(string message, Exception innerException)
    : Exception(message, innerException);
