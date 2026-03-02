using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.AspNetCore.Mvc;

namespace backend.Modules.Auth.Infrastructure;

public sealed class ApiAuthorizationMiddlewareResultHandler(IProblemDetailsService problemDetailsService)
    : IAuthorizationMiddlewareResultHandler
{
    private readonly AuthorizationMiddlewareResultHandler _defaultHandler = new();

    public async Task HandleAsync(
        RequestDelegate next,
        HttpContext context,
        AuthorizationPolicy policy,
        PolicyAuthorizationResult authorizeResult)
    {
        if (authorizeResult.Challenged)
        {
            await AuthorizationProblemDetailsWriter.WriteUnauthorizedAsync(context, problemDetailsService);
            return;
        }

        if (authorizeResult.Forbidden)
        {
            var code = ResolveForbiddenCode(authorizeResult.AuthorizationFailure);
            await AuthorizationProblemDetailsWriter.WriteForbiddenAsync(context, problemDetailsService, code);
            return;
        }

        await _defaultHandler.HandleAsync(next, context, policy, authorizeResult);
    }

    private static string ResolveForbiddenCode(AuthorizationFailure? failure)
    {
        if (failure is null)
        {
            return AuthorizationFailureCodes.Forbidden;
        }

        return failure.FailureReasons.Any(static reason => reason.Message == AuthorizationFailureCodes.UserBlocked)
            ? AuthorizationFailureCodes.UserBlocked
            : AuthorizationFailureCodes.Forbidden;
    }
}
