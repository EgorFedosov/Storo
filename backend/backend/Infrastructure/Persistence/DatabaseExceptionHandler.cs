using System.Data.Common;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace backend.Infrastructure.Persistence;

public sealed class DatabaseExceptionHandler(
    IProblemDetailsService problemDetailsService,
    ILogger<DatabaseExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (!IsDatabaseException(exception))
        {
            return false;
        }

        logger.LogError(exception, "Database request failed.");

        if (httpContext.Response.HasStarted)
        {
            return true;
        }

        httpContext.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;

        var problemDetails = new ProblemDetails
        {
            Status = StatusCodes.Status503ServiceUnavailable,
            Title = "Database unavailable",
            Detail = "The backend could not access PostgreSQL. Start the database and apply migrations.",
            Type = "https://httpstatuses.com/503"
        };

        problemDetails.Extensions["code"] = "database_unavailable";

        await problemDetailsService.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problemDetails
        });

        return true;
    }

    private static bool IsDatabaseException(Exception exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is DbException)
            {
                return true;
            }
        }

        return false;
    }
}