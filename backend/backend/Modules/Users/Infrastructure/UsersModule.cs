using backend.Infrastructure.Modularity;
using backend.Modules.Users.Api;
using backend.Modules.Users.Infrastructure.Persistence;
using backend.Modules.Users.UseCases.ListCurrentUserInventories;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Users.Infrastructure;

public sealed class UsersModule : IApiModule
{
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<IUserInventoryReadModel, EfCoreUserInventoryReadModel>();
        services.AddScoped<IListCurrentUserInventoriesUseCase, ListCurrentUserInventoriesUseCase>();
    }

    public void MapEndpoints(RouteGroupBuilder apiGroup)
    {
        apiGroup.MapUserInventoriesEndpoint();
    }
}
