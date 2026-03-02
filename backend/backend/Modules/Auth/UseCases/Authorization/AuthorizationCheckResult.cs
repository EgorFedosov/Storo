namespace backend.Modules.Auth.UseCases.Authorization;

public sealed record AuthorizationCheckResult(bool IsAllowed)
{
    public static AuthorizationCheckResult Allow { get; } = new(true);
    public static AuthorizationCheckResult Deny { get; } = new(false);
}
