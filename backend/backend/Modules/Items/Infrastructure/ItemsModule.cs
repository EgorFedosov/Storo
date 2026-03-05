using backend.Infrastructure.Modularity;
using backend.Modules.Items.Api;
using backend.Modules.Items.Infrastructure.Persistence;
using backend.Modules.Items.UseCases.ListInventoryItems;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Items.Infrastructure;

public sealed class ItemsModule : IApiModule
{
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<IItemsTableReadModel, EfCoreItemsTableReadModel>();
        services.AddScoped<IListInventoryItemsUseCase, ListInventoryItemsUseCase>();
    }

    public void MapEndpoints(RouteGroupBuilder apiGroup)
    {
        apiGroup.MapInventoryItemsEndpoint();
    }
}
