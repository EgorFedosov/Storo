using backend.Infrastructure.Modularity;
using backend.Modules.Integrations.Api;
using backend.Modules.Integrations.Infrastructure.Dropbox;
using backend.Modules.Integrations.Infrastructure.Persistence;
using backend.Modules.Integrations.Infrastructure.Salesforce;
using backend.Modules.Integrations.UseCases.Dropbox;
using backend.Modules.Integrations.UseCases.Salesforce;
using backend.Modules.Integrations.UseCases.SupportTickets;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Integrations.Infrastructure;

public sealed class IntegrationsModule : IApiModule
{
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton(DropboxOptions.FromConfiguration(configuration));
        services.AddSingleton(SalesforceOptions.FromConfiguration(configuration));
        services.AddHttpClient(DropboxAccessTokenClient.HttpClientName);
        services.AddHttpClient(SalesforceAccessTokenClient.HttpClientName);
        services.AddScoped<IDropboxAccessTokenClient, DropboxAccessTokenClient>();
        services.AddScoped<IDropboxUploadClient, DropboxUploadClient>();
        services.AddScoped<ISalesforceAccessTokenClient, SalesforceAccessTokenClient>();
        services.AddScoped<ISupportTicketExportRepository, EfCoreSupportTicketExportRepository>();
        services.AddScoped<ISalesforceContactRepository, EfCoreSalesforceContactRepository>();
        services.AddScoped<ICreateSupportTicketUseCase, CreateSupportTicketUseCase>();
        services.AddScoped<IGetSupportTicketStatusUseCase, GetSupportTicketStatusUseCase>();
    }

    public void MapEndpoints(RouteGroupBuilder apiGroup)
    {
        apiGroup.MapSupportTicketsEndpoint();
    }
}
