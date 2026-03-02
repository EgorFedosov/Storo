using backend.Modules.Auth.UseCases.CurrentUser;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Auth.Api;

public static class CurrentUserEndpoint
{
    public static void MapCurrentUserEndpoint(this RouteGroupBuilder apiGroup)
    {
        apiGroup
            .MapGet(
                "/auth/me",
                async Task<Ok<CurrentUserResponse>> (
                    IGetCurrentUserUseCase useCase,
                    CancellationToken cancellationToken) =>
                {
                    var result = await useCase.ExecuteAsync(new GetCurrentUserQuery(), cancellationToken);
                    return TypedResults.Ok(CurrentUserResponse.FromResult(result));
                })
            .WithName("GetCurrentUser")
            .AllowAnonymous();
    }
}
