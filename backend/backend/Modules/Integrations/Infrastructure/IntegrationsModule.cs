using backend.Infrastructure.Modularity;
using backend.Modules.Integrations.Infrastructure.Dropbox;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Integrations.Infrastructure;

public sealed class IntegrationsModule : IApiModule
{
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton(DropboxOptions.FromConfiguration(configuration));
    }

    public void MapEndpoints(RouteGroupBuilder apiGroup)
    {
    }
}

