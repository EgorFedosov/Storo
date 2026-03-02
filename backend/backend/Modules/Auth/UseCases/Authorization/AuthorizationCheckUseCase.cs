using Microsoft.AspNetCore.Authorization;

namespace backend.Modules.Auth.UseCases.Authorization;

public sealed class AuthorizationCheckUseCase(
    ICurrentUserAccessor currentUserAccessor,
    IAuthorizationService authorizationService) : IAuthorizationCheckUseCase
{
    public async Task<AuthorizationCheckResult> ExecuteAsync(AuthorizationCheck check, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(check.PolicyName);
        cancellationToken.ThrowIfCancellationRequested();

        var principal = currentUserAccessor.CurrentUser.Principal;
        var authorizationResult = await authorizationService.AuthorizeAsync(principal, check.Resource, check.PolicyName);

        return authorizationResult.Succeeded
            ? AuthorizationCheckResult.Allow
            : AuthorizationCheckResult.Deny;
    }
}
