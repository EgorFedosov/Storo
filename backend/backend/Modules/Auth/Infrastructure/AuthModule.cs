using backend.Infrastructure.Modularity;
using backend.Modules.Auth.UseCases.Authorization;
using Microsoft.AspNetCore.Authentication.Cookies;
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
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserAccessor, HttpContextCurrentUserAccessor>();
        services.AddScoped<IAuthorizationCheckUseCase, AuthorizationCheckUseCase>();
        services.AddScoped<IAuthorizationHandler, ActiveUserAuthorizationHandler>();
        services.AddSingleton<IAuthorizationMiddlewareResultHandler, ApiAuthorizationMiddlewareResultHandler>();

        services
            .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
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
            });

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
    }
}
