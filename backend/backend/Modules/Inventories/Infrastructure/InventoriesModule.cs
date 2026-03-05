using backend.Infrastructure.Modularity;
using backend.Modules.Inventories.Api;
using backend.Modules.Inventories.Infrastructure.Persistence;
using backend.Modules.Inventories.Infrastructure.Realtime;
using backend.Modules.Inventories.Infrastructure.Services;
using backend.Modules.Inventories.UseCases.Abstractions;
using backend.Modules.Inventories.UseCases.CustomIdTemplate;
using backend.Modules.Inventories.UseCases.CreateInventory;
using backend.Modules.Inventories.UseCases.Discussion;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Inventories.Infrastructure;

public sealed class InventoriesModule : IApiModule
{
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddSignalR();
        services.AddScoped<IInventoryRepository, EfCoreInventoryRepository>();
        services.AddScoped<ISequenceStateRepository, EfCoreSequenceStateRepository>();
        services.AddScoped<IDiscussionRepository, EfCoreDiscussionRepository>();
        services.AddScoped<IDiscussionHubPublisher, SignalRDiscussionHubPublisher>();
        services.AddScoped<ITagService, EfCoreTagService>();
        services.AddScoped<ICustomIdTemplateService, DefaultCustomIdTemplateService>();
        services.AddScoped<ICreateInventoryUseCase, CreateInventoryUseCase>();
        services.AddScoped<IGetInventoryDetailsUseCase, GetInventoryDetailsUseCase>();
        services.AddScoped<IReplaceCustomIdTemplateUseCase, ReplaceCustomIdTemplateUseCase>();
        services.AddScoped<IPreviewCustomIdTemplateUseCase, PreviewCustomIdTemplateUseCase>();
        services.AddScoped<IListDiscussionPostsUseCase, ListDiscussionPostsUseCase>();
        services.AddScoped<ICreateDiscussionPostUseCase, CreateDiscussionPostUseCase>();
    }

    public void MapEndpoints(RouteGroupBuilder apiGroup)
    {
        apiGroup.MapInventoryRootEndpoint();
        apiGroup.MapInventoryCustomIdTemplateEndpoint();
        apiGroup.MapInventoryDiscussionEndpoint();
    }
}
