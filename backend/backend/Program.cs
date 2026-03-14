using backend.Infrastructure.Configuration;
using backend.Infrastructure.Modularity;
using backend.Infrastructure.Persistence;
using backend.Modules.Inventories.Infrastructure.Realtime;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddDotEnvFile(Path.Combine(builder.Environment.ContentRootPath, ".env"));
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

var postgresConnectionString = ResolveJsonConnectionString(builder.Environment)
                               ?? builder.Configuration.GetConnectionString("Postgres")
                               ?? throw new InvalidOperationException("Connection string 'Postgres' was not found.");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(postgresConnectionString));
builder.Services.AddApiModules(builder.Configuration);
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<DatabaseExceptionHandler>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Backend API",
        Version = "v1"
    });
});
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor
        | ForwardedHeaders.XForwardedProto
        | ForwardedHeaders.XForwardedHost;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

var autoMigrateDatabase = app.Configuration.GetValue("Database:AutoMigrate", app.Environment.IsDevelopment());
if (autoMigrateDatabase)
{
    await using var scope = app.Services.CreateAsyncScope();
    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
        .CreateLogger("DatabaseStartup");

    try
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.MigrateAsync();
        logger.LogInformation("Database migrations applied successfully.");
    }
    catch (Exception exception)
    {
        logger.LogWarning(
            exception,
            "Database migration at startup failed. Endpoints that require database access may return 503 until the database becomes available.");
    }
}

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseForwardedHeaders();

var swaggerEnabled = app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Swagger:Enabled");
if (swaggerEnabled)
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "Backend API v1");
        options.RoutePrefix = "swagger";
    });
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapApiV1();
app.MapHub<DiscussionHub>("/hubs/discussions");

app.Run();

static string? ResolveJsonConnectionString(IHostEnvironment environment)
{
    var configuration = new ConfigurationBuilder()
        .SetBasePath(environment.ContentRootPath)
        .AddJsonFile("appsettings.json", optional: true, reloadOnChange: false)
        .AddJsonFile($"appsettings.{environment.EnvironmentName}.json", optional: true, reloadOnChange: false)
        .Build();

    var value = configuration.GetConnectionString("Postgres");
    return string.IsNullOrWhiteSpace(value)
        ? null
        : value.Trim();
}
