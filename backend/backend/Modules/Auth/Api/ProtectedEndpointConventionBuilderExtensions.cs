using backend.Modules.Auth.UseCases.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace backend.Modules.Auth.Api;

public static class ProtectedEndpointConventionBuilderExtensions
{
    public static TBuilder RequireAuthenticatedAccess<TBuilder>(this TBuilder builder)
        where TBuilder : IEndpointConventionBuilder
    {
        return builder
            .RequireAuthorization(AuthorizationPolicies.Authenticated)
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status401Unauthorized),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status403Forbidden));
    }
}
