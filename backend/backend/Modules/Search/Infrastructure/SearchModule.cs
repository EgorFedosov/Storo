using backend.Infrastructure.Modularity;
using backend.Modules.Search.Api;
using backend.Modules.Search.Infrastructure.Persistence;
using backend.Modules.Search.UseCases.Abstractions;
using backend.Modules.Search.UseCases.AutocompleteTags;
using backend.Modules.Search.UseCases.GetTagCloud;
using backend.Modules.Search.UseCases.SearchInventories;
using backend.Modules.Search.UseCases.SearchItems;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Search.Infrastructure;

public sealed class SearchModule : IApiModule
{
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<ISearchReadModel, EfCoreSearchReadModel>();
        services.AddScoped<ITagReadModel, EfCoreTagReadModel>();
        services.AddScoped<ISearchInventoriesUseCase, SearchInventoriesUseCase>();
        services.AddScoped<ISearchItemsUseCase, SearchItemsUseCase>();
        services.AddScoped<IAutocompleteTagsUseCase, AutocompleteTagsUseCase>();
        services.AddScoped<IGetTagCloudUseCase, GetTagCloudUseCase>();
    }

    public void MapEndpoints(RouteGroupBuilder apiGroup)
    {
        apiGroup.MapSearchEndpoints();
        apiGroup.MapTagEndpoints();
    }
}
