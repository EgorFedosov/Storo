using backend.Infrastructure.Modularity;
using backend.Modules.Items.Api;
using backend.Modules.Items.Infrastructure.Persistence;
using backend.Modules.Items.Infrastructure.Services;
using backend.Modules.Items.UseCases.CreateItem;
using backend.Modules.Items.UseCases.DeleteItem;
using backend.Modules.Items.UseCases.GetItemDetails;
using backend.Modules.Items.UseCases.Likes;
using backend.Modules.Items.UseCases.ListInventoryItems;
using backend.Modules.Items.UseCases.UpdateItem;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Items.Infrastructure;

public sealed class ItemsModule : IApiModule
{
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<IItemRepository, EfCoreItemRepository>();
        services.AddScoped<IItemLikeRepository, EfCoreItemLikeRepository>();
        services.AddScoped<IItemsTableReadModel, EfCoreItemsTableReadModel>();
        services.AddScoped<ICustomIdGenerationService, DefaultCustomIdGenerationService>();
        services.AddScoped<ICustomFieldValidationService, DefaultCustomFieldValidationService>();
        services.AddScoped<ICreateItemUseCase, CreateItemUseCase>();
        services.AddScoped<IListInventoryItemsUseCase, ListInventoryItemsUseCase>();
        services.AddScoped<IGetItemDetailsUseCase, GetItemDetailsUseCase>();
        services.AddScoped<IUpdateItemUseCase, UpdateItemUseCase>();
        services.AddScoped<IDeleteItemUseCase, DeleteItemUseCase>();
        services.AddScoped<ISetItemLikeUseCase, SetItemLikeUseCase>();
        services.AddScoped<IRemoveItemLikeUseCase, RemoveItemLikeUseCase>();
    }

    public void MapEndpoints(RouteGroupBuilder apiGroup)
    {
        apiGroup.MapInventoryItemsEndpoint();
        apiGroup.MapItemLifecycleEndpoint();
        apiGroup.MapItemLikesEndpoint();
    }
}
