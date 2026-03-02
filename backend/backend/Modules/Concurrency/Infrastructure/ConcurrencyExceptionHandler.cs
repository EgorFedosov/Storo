using backend.Modules.Concurrency.UseCases.Versioning;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace backend.Modules.Concurrency.Infrastructure;

public sealed class ConcurrencyExceptionHandler(IProblemDetailsService problemDetailsService) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is not VersioningException versioningException)
        {
            return false;
        }

        if (httpContext.Response.HasStarted)
        {
            return true;
        }

        httpContext.Response.StatusCode = versioningException.StatusCode;

        var problemDetails = new ProblemDetails
        {
            Status = versioningException.StatusCode,
            Title = versioningException.Title,
            Detail = versioningException.Message,
            Type = $"https://httpstatuses.com/{versioningException.StatusCode}"
        };

        problemDetails.Extensions["code"] = versioningException.Code;

        await problemDetailsService.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problemDetails
        });

        return true;
    }
}
