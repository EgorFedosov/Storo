using backend.Modules.Auth.UseCases.Logout;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Auth.Api;

public static class LogoutEndpoint
{
    public static void MapLogoutEndpoint(this RouteGroupBuilder apiGroup)
    {
        apiGroup
            .MapPost(
                "/auth/logout",
                async Task<NoContent> (
                    ILogoutUseCase useCase,
                    CancellationToken cancellationToken) =>
                {
                    await useCase.ExecuteAsync(new LogoutCommand(), cancellationToken);
                    return TypedResults.NoContent();
                })
            .WithName("Logout")
            .RequireAuthenticatedAccess();
    }
}
