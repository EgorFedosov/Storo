using System.Security.Claims;
using backend.Modules.Auth.UseCases.Authorization;

namespace backend.Modules.Auth.Infrastructure;

public sealed class HttpContextCurrentUserAccessor(IHttpContextAccessor httpContextAccessor) : ICurrentUserAccessor
{
    public CurrentUser CurrentUser => ResolveCurrentUser(httpContextAccessor.HttpContext?.User);

    private static CurrentUser ResolveCurrentUser(ClaimsPrincipal? principal)
    {
        var safePrincipal = principal ?? new ClaimsPrincipal(new ClaimsIdentity());
        var isAuthenticated = safePrincipal.Identity?.IsAuthenticated == true;
        var userId = TryParseUserId(safePrincipal);
        var isBlocked = string.Equals(
            safePrincipal.FindFirst(CurrentUserClaimTypes.IsBlocked)?.Value,
            bool.TrueString,
            StringComparison.OrdinalIgnoreCase);

        var roles = safePrincipal.FindAll(ClaimTypes.Role)
            .Select(static claim => claim.Value)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        return new CurrentUser(userId, isAuthenticated, isBlocked, roles, safePrincipal);
    }

    private static long? TryParseUserId(ClaimsPrincipal principal)
    {
        var rawUserId = principal.FindFirst(CurrentUserClaimTypes.UserId)?.Value;
        return long.TryParse(rawUserId, out var userId) ? userId : null;
    }
}
