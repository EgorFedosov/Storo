using backend.Infrastructure.Modularity;
using backend.Modules.Auth.Api;
using backend.Modules.Auth.UseCases.AuthProviders;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Auth.UseCases.ExternalLogin;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace backend.Modules.Auth.Infrastructure;

public sealed class AuthModule : IApiModule
{
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<AuthRedirectOptions>(configuration.GetSection(AuthRedirectOptions.SectionName));

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserAccessor, HttpContextCurrentUserAccessor>();
        services.AddScoped<IAuthorizationCheckUseCase, AuthorizationCheckUseCase>();
        services.AddScoped<IListAuthProvidersUseCase, ListAuthProvidersUseCase>();
        services.AddScoped<IStartGoogleLoginUseCase, StartGoogleLoginUseCase>();
        services.AddScoped<ICompleteGoogleLoginUseCase, CompleteGoogleLoginUseCase>();
        services.AddScoped<IExternalAuthService, AspNetExternalAuthService>();
        services.AddScoped<IUserRepository, EfCoreAuthUserRepository>();
        services.AddScoped<ISessionService, CookieSessionService>();
        services.AddScoped<IAuthorizationHandler, ActiveUserAuthorizationHandler>();
        services.AddSingleton<IAuthProviderRegistry, ConfigurationAuthProviderRegistry>();
        services.AddSingleton<IAuthorizationMiddlewareResultHandler, ApiAuthorizationMiddlewareResultHandler>();

        var authenticationBuilder = services
            .AddAuthentication(options =>
            {
                options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
                options.DefaultAuthenticateScheme = CookieAuthenticationDefaults.AuthenticationScheme;
                options.DefaultSignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = CookieAuthenticationDefaults.AuthenticationScheme;
            })
            .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, options =>
            {
                options.Cookie.Name = "__Host-backend.session";
                options.Cookie.HttpOnly = true;
                options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.Events.OnRedirectToLogin = static async context =>
                {
                    var problemDetailsService = context.HttpContext.RequestServices.GetRequiredService<IProblemDetailsService>();
                    await AuthorizationProblemDetailsWriter.WriteUnauthorizedAsync(context.HttpContext, problemDetailsService);
                };
                options.Events.OnRedirectToAccessDenied = static async context =>
                {
                    var code = string.Equals(
                        context.HttpContext.User.FindFirst(CurrentUserClaimTypes.IsBlocked)?.Value,
                        bool.TrueString,
                        StringComparison.OrdinalIgnoreCase)
                        ? AuthorizationFailureCodes.UserBlocked
                        : AuthorizationFailureCodes.Forbidden;

                    var problemDetailsService = context.HttpContext.RequestServices.GetRequiredService<IProblemDetailsService>();
                    await AuthorizationProblemDetailsWriter.WriteForbiddenAsync(context.HttpContext, problemDetailsService, code);
                };
            })
            .AddCookie(ExternalAuthDefaults.ExternalScheme, options =>
            {
                options.Cookie.Name = "__Host-backend.external";
                options.Cookie.HttpOnly = true;
                options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.ExpireTimeSpan = TimeSpan.FromMinutes(5);
                options.SlidingExpiration = false;
            });

        var googleClientId = configuration["Authentication:Google:ClientId"];
        var googleClientSecret = configuration["Authentication:Google:ClientSecret"];

        if (!string.IsNullOrWhiteSpace(googleClientId) && !string.IsNullOrWhiteSpace(googleClientSecret))
        {
            authenticationBuilder.AddGoogle(ExternalAuthDefaults.GoogleScheme, options =>
            {
                options.SignInScheme = ExternalAuthDefaults.ExternalScheme;
                options.ClientId = googleClientId;
                options.ClientSecret = googleClientSecret;
                options.CallbackPath = ExternalAuthDefaults.GoogleHandlerCallbackPath;
            });
        }

        services.AddAuthorization(options =>
        {
            options.AddPolicy(AuthorizationPolicies.Authenticated, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.AddRequirements(new ActiveUserRequirement());
            });

            options.AddPolicy(AuthorizationPolicies.Admin, policy =>
            {
                policy.RequireRole("admin");
                policy.AddRequirements(new ActiveUserRequirement());
            });
        });
    }

    public void MapEndpoints(RouteGroupBuilder apiGroup)
    {
        apiGroup.MapAuthProvidersEndpoint();
        apiGroup.MapExternalGoogleLoginEndpoints();
    }
}
