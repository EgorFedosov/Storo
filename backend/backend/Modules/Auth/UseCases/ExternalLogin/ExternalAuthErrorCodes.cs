namespace backend.Modules.Auth.UseCases.ExternalLogin;

public static class ExternalAuthErrorCodes
{
    public const string ExternalAuthFailed = "external_auth_failed";
    public const string ProviderUnavailable = "external_provider_unavailable";
    public const string MissingExternalIdentity = "missing_external_identity";
    public const string UserBlocked = "user_blocked";
}
