using backend.Modules.Systems.UseCases.Home;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Systems.Api;

public static class HomeEndpoint
{
    public static void MapHomeEndpoint(this RouteGroupBuilder apiGroup)
    {
        apiGroup
            .MapGet(
                "/home",
                async Task<Ok<HomeResponse>> (IGetHomePageDataUseCase useCase, CancellationToken cancellationToken) =>
                {
                    var result = await useCase.ExecuteAsync(new GetHomePageDataQuery(), cancellationToken);
                    return TypedResults.Ok(HomeResponse.FromResult(result));
                })
            .WithName("GetHomePageData")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(HomeResponse), StatusCodes.Status200OK));
    }
}
