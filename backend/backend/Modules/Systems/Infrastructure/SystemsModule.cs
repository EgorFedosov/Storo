using backend.Infrastructure.Modularity;
using backend.Infrastructure.Time;
using backend.Modules.Systems.Api;
using backend.Modules.Systems.UseCases.Ping;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Systems.Infrastructure;

public sealed class SystemsModule : IApiModule
{
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<IClock, SystemClock>();
        services.AddScoped<IPingUseCase, PingUseCase>();
    }

    public void MapEndpoints(RouteGroupBuilder apiGroup)
    {
        apiGroup.MapPingEndpoint();
    }
}
