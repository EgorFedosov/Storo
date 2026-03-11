using backend.Infrastructure.Modularity;
using backend.Modules.Auth.Api;
using backend.Modules.Auth.UseCases.AuthProviders;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Auth.UseCases.CurrentUser;
using backend.Modules.Auth.UseCases.ExternalLogin;
using backend.Modules.Auth.UseCases.Logout;
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
        services.AddScoped<IGetCurrentUserUseCase, GetCurrentUserUseCase>();
        services.AddScoped<ILogoutUseCase, LogoutUseCase>();
        services.AddScoped<IStartGoogleLoginUseCase, StartGoogleLoginUseCase>();
        services.AddScoped<ICompleteGoogleLoginUseCase, CompleteGoogleLoginUseCase>();
        services.AddScoped<IExternalAuthService, AspNetExternalAuthService>();
        services.AddScoped<IUserRepository, EfCoreAuthUserRepository>();
        services.AddScoped<IUserReadRepository, EfCoreUserReadRepository>();
        services.AddScoped<ISessionService, CookieSessionService>();
        services.AddScoped<IAuthorizationHandler, ActiveUserAuthorizationHandler>();
        services.AddSingleton<IAuthProviderRegistry, ConfigurationAuthProviderRegistry>();
        services.AddSingleton<IPermissionService, DefaultPermissionService>();
        services.AddSingleton<IAuthorizationMiddlewareResultHandler, ApiAuthorizationMiddlewareResultHandler>();

        var useSecureCookies = configuration.GetValue("Auth:UseSecureCookies", true);
        var cookieSecurePolicy = useSecureCookies
            ? CookieSecurePolicy.Always
            : CookieSecurePolicy.SameAsRequest;
        var sessionCookieName = useSecureCookies
            ? "__Host-backend.session"
            : "backend.session";
        var externalCookieName = useSecureCookies
            ? "__Host-backend.external"
            : "backend.external";

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
                options.Cookie.Name = sessionCookieName;
                options.Cookie.HttpOnly = true;
                options.Cookie.SecurePolicy = cookieSecurePolicy;
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
                options.Cookie.Name = externalCookieName;
                options.Cookie.HttpOnly = true;
                options.Cookie.SecurePolicy = cookieSecurePolicy;
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

                // Local HTTP development needs non-secure correlation cookies.
                options.CorrelationCookie.SecurePolicy = cookieSecurePolicy;
                options.CorrelationCookie.SameSite = useSecureCookies
                    ? SameSiteMode.None
                    : SameSiteMode.Lax;
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
        apiGroup.MapCurrentUserEndpoint();
        apiGroup.MapExternalGoogleLoginEndpoints();
        apiGroup.MapLogoutEndpoint();
    }
}
