using backend.Infrastructure.Modularity;
using backend.Modules.Integrations.Infrastructure.Dropbox;
using backend.Modules.Integrations.Infrastructure.Persistence;
using backend.Modules.Integrations.UseCases.Dropbox;
using backend.Modules.Integrations.UseCases.SupportTickets;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Integrations.Infrastructure;

public sealed class IntegrationsModule : IApiModule
{
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton(DropboxOptions.FromConfiguration(configuration));
        services.AddHttpClient(DropboxAccessTokenClient.HttpClientName);
        services.AddScoped<IDropboxAccessTokenClient, DropboxAccessTokenClient>();
        services.AddScoped<IDropboxUploadClient, DropboxUploadClient>();
        services.AddScoped<ISupportTicketExportRepository, EfCoreSupportTicketExportRepository>();
    }

    public void MapEndpoints(RouteGroupBuilder apiGroup)
    {
    }
}
