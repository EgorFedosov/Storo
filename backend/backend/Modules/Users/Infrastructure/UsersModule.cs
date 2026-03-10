using backend.Infrastructure.Modularity;
using backend.Modules.Users.Api;
using backend.Modules.Users.Infrastructure.Persistence;
using backend.Modules.Users.UseCases.AdminModeration;
using backend.Modules.Users.UseCases.ListCurrentUserInventories;
using backend.Modules.Users.UseCases.ListUsersForAdmin;
using backend.Modules.Users.UseCases.Preferences;
using Microsoft.AspNetCore.Routing;
using AdminModerationUserRepository = backend.Modules.Users.UseCases.AdminModeration.IUserRepository;
using PreferencesUserRepository = backend.Modules.Users.UseCases.Preferences.IUserRepository;

namespace backend.Modules.Users.Infrastructure;

public sealed class UsersModule : IApiModule
{
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<AdminModerationUserRepository, EfCoreAdminModerationUserRepository>();
        services.AddScoped<IRoleService, EfCoreRoleService>();
        services.AddScoped<AdminModerationUseCase>();
        services.AddScoped<IBlockUserUseCase>(serviceProvider => serviceProvider.GetRequiredService<AdminModerationUseCase>());
        services.AddScoped<IUnblockUserUseCase>(serviceProvider => serviceProvider.GetRequiredService<AdminModerationUseCase>());
        services.AddScoped<IGrantAdminUseCase>(serviceProvider => serviceProvider.GetRequiredService<AdminModerationUseCase>());
        services.AddScoped<IRevokeAdminUseCase>(serviceProvider => serviceProvider.GetRequiredService<AdminModerationUseCase>());
        services.AddScoped<IDeleteUserUseCase>(serviceProvider => serviceProvider.GetRequiredService<AdminModerationUseCase>());

        services.AddScoped<IAdminUsersReadRepository, EfCoreAdminUsersReadRepository>();
        services.AddScoped<IListUsersForAdminUseCase, ListUsersForAdminUseCase>();

        services.AddScoped<IUserInventoryReadModel, EfCoreUserInventoryReadModel>();
        services.AddScoped<IListCurrentUserInventoriesUseCase, ListCurrentUserInventoriesUseCase>();

        services.AddScoped<PreferencesUserRepository, EfCoreUserRepository>();
        services.AddScoped<IUpdateCurrentUserPreferencesUseCase, UpdateCurrentUserPreferencesUseCase>();
    }

    public void MapEndpoints(RouteGroupBuilder apiGroup)
    {
        apiGroup.MapAdminUsersEndpoint();
        apiGroup.MapAdminModerationEndpoint();
        apiGroup.MapUserInventoriesEndpoint();
        apiGroup.MapUserPreferencesEndpoint();
    }
}