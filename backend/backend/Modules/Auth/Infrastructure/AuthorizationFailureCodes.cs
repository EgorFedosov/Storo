namespace backend.Modules.Auth.Infrastructure;

internal static class AuthorizationFailureCodes
{
    public const string AuthenticationRequired = "authentication_required";
    public const string Forbidden = "forbidden";
    public const string UserBlocked = "user_blocked";
}
