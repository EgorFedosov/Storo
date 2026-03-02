using Microsoft.AspNetCore.Mvc;

namespace backend.Modules.Auth.Infrastructure;

internal static class AuthorizationProblemDetailsWriter
{
    public static Task WriteUnauthorizedAsync(HttpContext context, IProblemDetailsService problemDetailsService)
    {
        return WriteAsync(
            context,
            problemDetailsService,
            StatusCodes.Status401Unauthorized,
            "Unauthorized",
            "Authentication is required to access this resource.",
            AuthorizationFailureCodes.AuthenticationRequired);
    }

    public static Task WriteForbiddenAsync(
        HttpContext context,
        IProblemDetailsService problemDetailsService,
        string code)
    {
        var detail = code == AuthorizationFailureCodes.UserBlocked
            ? "Current user is blocked."
            : "You do not have permission to access this resource.";

        return WriteAsync(
            context,
            problemDetailsService,
            StatusCodes.Status403Forbidden,
            "Forbidden",
            detail,
            code);
    }

    private static async Task WriteAsync(
        HttpContext context,
        IProblemDetailsService problemDetailsService,
        int statusCode,
        string title,
        string detail,
        string code)
    {
        if (context.Response.HasStarted)
        {
            return;
        }

        context.Response.StatusCode = statusCode;

        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = detail,
            Type = $"https://httpstatuses.com/{statusCode}"
        };

        problemDetails.Extensions["code"] = code;

        await problemDetailsService.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails = problemDetails
        });
    }
}
