using backend.Modules.Auth.UseCases.Authorization;
using Microsoft.AspNetCore.Authorization;

namespace backend.Modules.Auth.Infrastructure;

public sealed class ActiveUserAuthorizationHandler(ICurrentUserAccessor currentUserAccessor)
    : AuthorizationHandler<ActiveUserRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ActiveUserRequirement requirement)
    {
        var currentUser = currentUserAccessor.CurrentUser;

        if (!currentUser.IsAuthenticated)
        {
            return Task.CompletedTask;
        }

        if (currentUser.IsBlocked)
        {
            context.Fail(new AuthorizationFailureReason(this, AuthorizationFailureCodes.UserBlocked));
            return Task.CompletedTask;
        }

        context.Succeed(requirement);
        return Task.CompletedTask;
    }
}
