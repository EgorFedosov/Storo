using backend.Modules.Systems.UseCases.Ping;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Systems.Api;

public static class PingEndpoint
{
    public static void MapPingEndpoint(this RouteGroupBuilder apiGroup)
    {
        apiGroup
            .MapGet(
                "/ping",
                async Task<Ok<PingResponse>> (IPingUseCase useCase, CancellationToken cancellationToken) =>
                {
                    var result = await useCase.ExecuteAsync(new PingQuery(), cancellationToken);
                    return TypedResults.Ok(PingResponse.FromResult(result));
                })
            .WithName("Ping");
    }
}
