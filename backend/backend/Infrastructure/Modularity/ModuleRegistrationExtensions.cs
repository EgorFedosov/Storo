using backend.Modules.Auth.Infrastructure;
using backend.Modules.Concurrency.Infrastructure;
using backend.Modules.Integrations.Infrastructure;
using backend.Modules.Inventories.Infrastructure;
using backend.Modules.Items.Infrastructure;
using backend.Modules.Search.Infrastructure;
using backend.Modules.Systems.Infrastructure;
using backend.Modules.Users.Infrastructure;

namespace backend.Infrastructure.Modularity;

public static class ModuleRegistrationExtensions
{
    private static readonly IApiModule[] Modules =
    [
        new AuthModule(),
        new ConcurrencyModule(),
        new IntegrationsModule(),
        new InventoriesModule(),
        new ItemsModule(),
        new SearchModule(),
        new SystemsModule(),
        new UsersModule()
    ];

    public static IServiceCollection AddApiModules(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        foreach (var module in Modules)
        {
            module.RegisterServices(services, configuration);
        }

        return services;
    }

    public static IEndpointRouteBuilder MapApiV1(this IEndpointRouteBuilder app)
    {
        var apiGroup = app.MapGroup("/api/v1");

        foreach (var module in Modules)
        {
            module.MapEndpoints(apiGroup);
        }

        return app;
    }
}
