using backend.Infrastructure.Modularity;
using backend.Modules.Concurrency.Api;
using backend.Modules.Concurrency.UseCases.Versioning;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Concurrency.Infrastructure;

public sealed class ConcurrencyModule : IApiModule
{
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<IETagService, ETagService>();
        services.AddScoped<IUnitOfWork, EfCoreUnitOfWork>();
        services.AddScoped<IVersionedCommandUseCase, VersionedCommandUseCase>();
        services.AddScoped<RequireIfMatchEndpointFilter>();
        services.AddExceptionHandler<ConcurrencyExceptionHandler>();
    }

    public void MapEndpoints(RouteGroupBuilder apiGroup)
    {
    }
}
