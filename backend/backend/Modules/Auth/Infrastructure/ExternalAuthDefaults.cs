namespace backend.Modules.Auth.Infrastructure;

public static class ExternalAuthDefaults
{
    public const string ExternalScheme = "auth.external";
    public const string GoogleScheme = "Google";
    public const string GitHubScheme = "GitHub";
    public const string GoogleHandlerCallbackPath = "/api/v1/auth/external/google/handler";
    public const string GoogleCompletionPath = "/api/v1/auth/external/google/callback";
    public const string GitHubHandlerCallbackPath = "/api/v1/auth/external/github/handler";
    public const string GitHubCompletionPath = "/api/v1/auth/external/github/callback";
    public const string ReturnUrlItemKey = "return_url";
}
