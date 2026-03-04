using backend.Infrastructure.Modularity;
using backend.Modules.Inventories.Api;
using backend.Modules.Inventories.Infrastructure.Persistence;
using backend.Modules.Inventories.UseCases.Abstractions;
using backend.Modules.Inventories.UseCases.CreateInventory;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Inventories.Infrastructure;

public sealed class InventoriesModule : IApiModule
{
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<IInventoryRepository, EfCoreInventoryRepository>();
        services.AddScoped<ITagService, EfCoreTagService>();
        services.AddScoped<ICreateInventoryUseCase, CreateInventoryUseCase>();
        services.AddScoped<IGetInventoryDetailsUseCase, GetInventoryDetailsUseCase>();
    }

    public void MapEndpoints(RouteGroupBuilder apiGroup)
    {
        apiGroup.MapInventoryRootEndpoint();
    }
}
