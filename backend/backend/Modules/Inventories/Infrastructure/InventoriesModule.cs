using backend.Infrastructure.Modularity;
using backend.Modules.Inventories.Api;
using backend.Modules.Inventories.Infrastructure.Persistence;
using backend.Modules.Inventories.Infrastructure.Realtime;
using backend.Modules.Inventories.Infrastructure.Services;
using backend.Modules.Inventories.Infrastructure.Storage;
using backend.Modules.Inventories.UseCases.Abstractions;
using backend.Modules.Inventories.UseCases.CustomIdTemplate;
using backend.Modules.Inventories.UseCases.CreateInventory;
using backend.Modules.Inventories.UseCases.DeleteInventory;
using backend.Modules.Inventories.UseCases.Discussion;
using backend.Modules.Inventories.UseCases.EditorMutations;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;
using backend.Modules.Inventories.UseCases.GetInventoryEditor;
using backend.Modules.Inventories.UseCases.ImageUpload;
using backend.Modules.Inventories.UseCases.Statistics;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Inventories.Infrastructure;

public sealed class InventoriesModule : IApiModule
{
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<ImageStoragePresignOptions>(
            configuration.GetSection(ImageStoragePresignOptions.SectionName));
        services.AddSingleton(SupabaseStorageOptions.FromConfiguration(configuration));
        services.AddHttpClient(SupabaseInventoryAssetStorageService.HttpClientName);

        services.AddSignalR();
        services.AddScoped<IInventoryRepository, EfCoreInventoryRepository>();
        services.AddScoped<IInventoryEditorReadModel, EfCoreInventoryEditorReadModel>();
        services.AddScoped<IStatisticsReadModel, EfCoreStatisticsReadModel>();
        services.AddScoped<ISequenceStateRepository, EfCoreSequenceStateRepository>();
        services.AddScoped<IDiscussionRepository, EfCoreDiscussionRepository>();
        services.AddScoped<IDiscussionHubPublisher, SignalRDiscussionHubPublisher>();
        services.AddScoped<IAccessService, EfCoreAccessService>();
        services.AddScoped<ITagService, EfCoreTagService>();
        services.AddScoped<ICustomIdTemplateService, DefaultCustomIdTemplateService>();
        services.AddScoped<ICustomFieldService, DefaultCustomFieldService>();
        services.AddScoped<IImageStoragePresignService, ConfigurationImageStoragePresignService>();
        services.AddScoped<IInventoryAssetStorageService, SupabaseInventoryAssetStorageService>();
        services.AddScoped<ICreateInventoryUseCase, CreateInventoryUseCase>();
        services.AddScoped<IGetInventoryDetailsUseCase, GetInventoryDetailsUseCase>();
        services.AddScoped<IGetInventoryEditorUseCase, GetInventoryEditorUseCase>();
        services.AddScoped<IDeleteInventoryUseCase, DeleteInventoryUseCase>();
        services.AddScoped<IUpdateInventorySettingsUseCase, UpdateInventorySettingsUseCase>();
        services.AddScoped<IReplaceInventoryTagsUseCase, ReplaceInventoryTagsUseCase>();
        services.AddScoped<IReplaceInventoryAccessUseCase, ReplaceInventoryAccessUseCase>();
        services.AddScoped<IReplaceInventoryCustomFieldsUseCase, ReplaceInventoryCustomFieldsUseCase>();
        services.AddScoped<IReplaceCustomIdTemplateUseCase, ReplaceCustomIdTemplateUseCase>();
        services.AddScoped<IPreviewCustomIdTemplateUseCase, PreviewCustomIdTemplateUseCase>();
        services.AddScoped<IListDiscussionPostsUseCase, ListDiscussionPostsUseCase>();
        services.AddScoped<ICreateDiscussionPostUseCase, CreateDiscussionPostUseCase>();
        services.AddScoped<ICreateInventoryImageUploadUseCase, CreateInventoryImageUploadUseCase>();
        services.AddScoped<IGetInventoryStatisticsUseCase, GetInventoryStatisticsUseCase>();
    }

    public void MapEndpoints(RouteGroupBuilder apiGroup)
    {
        apiGroup.MapInventoryRootEndpoint();
        apiGroup.MapInventoryEditorMutationsEndpoint();
        apiGroup.MapInventoryCustomFieldsEndpoint();
        apiGroup.MapInventoryCustomIdTemplateEndpoint();
        apiGroup.MapInventoryDiscussionEndpoint();
        apiGroup.MapInventoryStatisticsEndpoint();
        apiGroup.MapImageUploadsEndpoint();
    }
}
