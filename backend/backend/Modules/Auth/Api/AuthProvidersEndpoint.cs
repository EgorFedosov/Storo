using backend.Modules.Auth.UseCases.AuthProviders;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Auth.Api;

public static class AuthProvidersEndpoint
{
    public static void MapAuthProvidersEndpoint(this RouteGroupBuilder apiGroup)
    {
        apiGroup
            .MapGet(
                "/auth/providers",
                async Task<Ok<AuthProvidersResponse>> (
                    IListAuthProvidersUseCase useCase,
                    CancellationToken cancellationToken) =>
                {
                    var result = await useCase.ExecuteAsync(new ListAuthProvidersQuery(), cancellationToken);
                    return TypedResults.Ok(AuthProvidersResponse.FromResult(result));
                })
            .WithName("ListAuthProviders")
            .AllowAnonymous();
    }
}
