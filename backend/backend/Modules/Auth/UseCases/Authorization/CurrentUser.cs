using System.Security.Claims;

namespace backend.Modules.Auth.UseCases.Authorization;

public sealed record CurrentUser(
    long? UserId,
    bool IsAuthenticated,
    bool IsBlocked,
    IReadOnlyCollection<string> Roles,
    ClaimsPrincipal Principal);
