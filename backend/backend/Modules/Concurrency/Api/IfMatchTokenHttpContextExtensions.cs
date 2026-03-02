using backend.Modules.Concurrency.UseCases.Versioning;

namespace backend.Modules.Concurrency.Api;

public static class IfMatchTokenHttpContextExtensions
{
    private static readonly object IfMatchTokenItemKey = new();

    internal static void SetIfMatchToken(this HttpContext httpContext, IfMatchToken token)
    {
        httpContext.Items[IfMatchTokenItemKey] = token;
    }

    public static IfMatchToken GetIfMatchToken(this HttpContext httpContext)
    {
        if (httpContext.Items.TryGetValue(IfMatchTokenItemKey, out var value) && value is IfMatchToken token)
        {
            return token;
        }

        throw new IfMatchRequiredException();
    }

    public static void SetETag(this HttpResponse httpResponse, VersionedResult result)
    {
        httpResponse.Headers.ETag = result.ETag;
    }
}
