using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace backend.Modules.Concurrency.Api;

public static class ConcurrencyEndpointConventionBuilderExtensions
{
    public static RouteHandlerBuilder RequireIfMatch(this RouteHandlerBuilder builder)
    {
        return builder
            .AddEndpointFilter<RequireIfMatchEndpointFilter>()
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status400BadRequest),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status412PreconditionFailed),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status428PreconditionRequired));
    }
}
