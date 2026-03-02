using System.Security.Claims;

namespace backend.Modules.Auth.UseCases.Authorization;

public static class CurrentUserClaimTypes
{
    public const string UserId = ClaimTypes.NameIdentifier;
    public const string IsBlocked = "is_blocked";
}
