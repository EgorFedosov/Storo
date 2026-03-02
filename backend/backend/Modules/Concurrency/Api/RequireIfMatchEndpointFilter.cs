using backend.Modules.Concurrency.UseCases.Versioning;
using Microsoft.Net.Http.Headers;

namespace backend.Modules.Concurrency.Api;

public sealed class RequireIfMatchEndpointFilter(IETagService eTagService) : IEndpointFilter
{
    public ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        if (!context.HttpContext.Request.Headers.TryGetValue(HeaderNames.IfMatch, out var rawIfMatch)
            || string.IsNullOrWhiteSpace(rawIfMatch.ToString()))
        {
            throw new IfMatchRequiredException();
        }

        if (!eTagService.TryParseIfMatch(rawIfMatch.ToString(), out var token))
        {
            throw new InvalidIfMatchTokenException(rawIfMatch.ToString());
        }

        context.HttpContext.SetIfMatchToken(token);
        return next(context);
    }
}
