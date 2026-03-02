using System.Security.Claims;
using backend.Modules.Auth.UseCases.ExternalLogin;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace backend.Modules.Auth.Infrastructure;

public sealed class AspNetExternalAuthService(
    IHttpContextAccessor httpContextAccessor,
    IAuthenticationSchemeProvider authenticationSchemeProvider,
    IOptions<AuthRedirectOptions> redirectOptionsAccessor) : IExternalAuthService
{
    private readonly AuthRedirectOptions redirectOptions = redirectOptionsAccessor.Value;

    public async Task<ExternalAuthChallengeResult> StartGoogleChallengeAsync(
        StartGoogleLoginCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        var scheme = await authenticationSchemeProvider.GetSchemeAsync(ExternalAuthDefaults.GoogleScheme);
        if (scheme is null)
        {
            return ExternalAuthChallengeResult.Redirect(
                BuildErrorRedirectUri(ExternalAuthErrorCodes.ProviderUnavailable));
        }

        var returnUrl = ResolveSuccessRedirect(command.ReturnUrl);

        var properties = new AuthenticationProperties
        {
            RedirectUri = ExternalAuthDefaults.GoogleCompletionPath
        };
        properties.Items[ExternalAuthDefaults.ReturnUrlItemKey] = returnUrl;

        return ExternalAuthChallengeResult.Ready(
            new ExternalAuthChallenge(ExternalAuthDefaults.GoogleScheme, properties));
    }

    public async Task<ExternalAuthCallbackResult> CompleteGoogleAuthenticationAsync(
        CompleteGoogleLoginCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        if (!string.IsNullOrWhiteSpace(command.Error))
        {
            return ExternalAuthCallbackResult.Redirect(
                BuildErrorRedirectUri(ExternalAuthErrorCodes.ExternalAuthFailed));
        }

        var httpContext = ResolveHttpContext();
        var authenticateResult = await httpContext.AuthenticateAsync(ExternalAuthDefaults.ExternalScheme);

        if (!authenticateResult.Succeeded || authenticateResult.Principal is null)
        {
            return ExternalAuthCallbackResult.Redirect(
                BuildErrorRedirectUri(ExternalAuthErrorCodes.ExternalAuthFailed));
        }

        var providerUserId = FindClaimValue(authenticateResult.Principal, ClaimTypes.NameIdentifier, "sub");
        var email = FindClaimValue(authenticateResult.Principal, ClaimTypes.Email, "email");

        if (string.IsNullOrWhiteSpace(providerUserId) || string.IsNullOrWhiteSpace(email))
        {
            return ExternalAuthCallbackResult.Redirect(
                BuildErrorRedirectUri(ExternalAuthErrorCodes.MissingExternalIdentity));
        }

        var displayName = FindClaimValue(authenticateResult.Principal, ClaimTypes.Name, "name");
        if (string.IsNullOrWhiteSpace(displayName))
        {
            displayName = email;
        }

        var returnUrl = ResolveSuccessRedirect(
            ResolveReturnUrl(command.ReturnUrl, authenticateResult.Properties));

        var identity = new ExternalAuthIdentity(
            "google",
            providerUserId.Trim(),
            email.Trim(),
            displayName.Trim());

        return ExternalAuthCallbackResult.Authenticated(returnUrl, identity);
    }

    public Task ClearExternalStateAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return ResolveHttpContext().SignOutAsync(ExternalAuthDefaults.ExternalScheme);
    }

    public string BuildErrorRedirectUri(string errorCode)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(errorCode);

        var baseErrorUri = NormalizeConfiguredRedirect(redirectOptions.ErrorPath, "/auth/error");
        return AppendQueryParameter(baseErrorUri, "code", errorCode);
    }

    private string ResolveSuccessRedirect(string? requestedReturnUrl)
    {
        if (IsSafeRelativeReturnUrl(requestedReturnUrl))
        {
            return requestedReturnUrl!.Trim();
        }

        return NormalizeConfiguredRedirect(redirectOptions.SuccessPath, "/");
    }

    private static string? ResolveReturnUrl(string? fallbackReturnUrl, AuthenticationProperties? properties)
    {
        if (properties?.Items.TryGetValue(ExternalAuthDefaults.ReturnUrlItemKey, out var returnUrl) == true
            && !string.IsNullOrWhiteSpace(returnUrl))
        {
            return returnUrl;
        }

        return fallbackReturnUrl;
    }

    private static string FindClaimValue(
        ClaimsPrincipal principal,
        string primaryClaimType,
        string secondaryClaimType)
    {
        return principal.FindFirst(primaryClaimType)?.Value
               ?? principal.FindFirst(secondaryClaimType)?.Value
               ?? string.Empty;
    }

    private static string NormalizeConfiguredRedirect(string? configuredValue, string fallback)
    {
        if (string.IsNullOrWhiteSpace(configuredValue))
        {
            return fallback;
        }

        var trimmed = configuredValue.Trim();

        if (IsSafeRelativeReturnUrl(trimmed) || IsAbsoluteHttpUri(trimmed))
        {
            return trimmed;
        }

        return fallback;
    }

    private static bool IsSafeRelativeReturnUrl(string? returnUrl)
    {
        if (string.IsNullOrWhiteSpace(returnUrl))
        {
            return false;
        }

        var trimmed = returnUrl.Trim();
        return trimmed.StartsWith("/", StringComparison.Ordinal)
               && !trimmed.StartsWith("//", StringComparison.Ordinal)
               && !trimmed.StartsWith("/\\", StringComparison.Ordinal);
    }

    private static bool IsAbsoluteHttpUri(string value)
    {
        return Uri.TryCreate(value, UriKind.Absolute, out var uri)
               && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }

    private static string AppendQueryParameter(string uri, string key, string value)
    {
        var separator = uri.Contains('?', StringComparison.Ordinal) ? "&" : "?";
        return $"{uri}{separator}{Uri.EscapeDataString(key)}={Uri.EscapeDataString(value)}";
    }

    private HttpContext ResolveHttpContext()
    {
        return httpContextAccessor.HttpContext
               ?? throw new InvalidOperationException("External auth flow requires active HTTP context.");
    }
}
