using Microsoft.AspNetCore.Routing;

namespace backend.Infrastructure.Modularity;

public interface IApiModule
{
    void RegisterServices(IServiceCollection services, IConfiguration configuration);
    void MapEndpoints(RouteGroupBuilder apiGroup);
}
