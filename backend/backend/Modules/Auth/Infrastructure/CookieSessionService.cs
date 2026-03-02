using System.Globalization;
using System.Security.Claims;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Auth.UseCases.ExternalLogin;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace backend.Modules.Auth.Infrastructure;

public sealed class CookieSessionService(IHttpContextAccessor httpContextAccessor) : ISessionService
{
    public Task SignInAsync(AuthenticatedUser user, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(user);
        cancellationToken.ThrowIfCancellationRequested();

        var claims = BuildClaims(user);
        var principal = new ClaimsPrincipal(
            new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme));

        var authProperties = new AuthenticationProperties
        {
            IsPersistent = true,
            AllowRefresh = true,
            IssuedUtc = DateTimeOffset.UtcNow
        };

        return ResolveHttpContext().SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            authProperties);
    }

    public Task SignOutAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return ResolveHttpContext().SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    }

    private static IReadOnlyCollection<Claim> BuildClaims(AuthenticatedUser user)
    {
        var claims = new List<Claim>
        {
            new(CurrentUserClaimTypes.UserId, user.UserId.ToString(CultureInfo.InvariantCulture)),
            new(CurrentUserClaimTypes.IsBlocked, user.IsBlocked.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, user.DisplayName)
        };

        foreach (var role in user.Roles.Where(static role => !string.IsNullOrWhiteSpace(role)))
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        return claims;
    }

    private HttpContext ResolveHttpContext()
    {
        return httpContextAccessor.HttpContext
               ?? throw new InvalidOperationException("Session flow requires active HTTP context.");
    }
}
