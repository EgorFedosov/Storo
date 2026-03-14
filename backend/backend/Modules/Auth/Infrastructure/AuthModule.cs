using backend.Infrastructure.Modularity;
using backend.Modules.Auth.Api;
using backend.Modules.Auth.UseCases.AuthProviders;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Auth.UseCases.CurrentUser;
using backend.Modules.Auth.UseCases.ExternalLogin;
using backend.Modules.Auth.UseCases.LocalAuth;
using backend.Modules.Auth.UseCases.Logout;
using backend.Modules.Users.Domain;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authentication.OAuth;
using Microsoft.AspNetCore.Authentication.OAuth.Claims;
using Microsoft.AspNetCore.Identity;
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
        services.AddScoped<IStartGitHubLoginUseCase, StartGitHubLoginUseCase>();
        services.AddScoped<ICompleteGitHubLoginUseCase, CompleteGitHubLoginUseCase>();
        services.AddScoped<IRegisterWithPasswordUseCase, RegisterWithPasswordUseCase>();
        services.AddScoped<ILoginWithPasswordUseCase, LoginWithPasswordUseCase>();
        services.AddScoped<IExternalAuthService, AspNetExternalAuthService>();
        services.AddScoped<ILocalCredentialsRepository, EfCoreLocalCredentialsRepository>();
        services.AddScoped<IUserRepository, EfCoreAuthUserRepository>();
        services.AddScoped<IUserReadRepository, EfCoreUserReadRepository>();
        services.AddScoped<ISessionService, CookieSessionService>();
        services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
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
        var gitHubClientId = configuration["Authentication:GitHub:ClientId"];
        var gitHubClientSecret = configuration["Authentication:GitHub:ClientSecret"];

        ConfigureGoogleAuthentication(
            authenticationBuilder,
            googleClientId,
            googleClientSecret,
            cookieSecurePolicy,
            useSecureCookies);

        ConfigureGitHubAuthentication(
            authenticationBuilder,
            gitHubClientId,
            gitHubClientSecret,
            cookieSecurePolicy,
            useSecureCookies);

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
        apiGroup.MapLocalCredentialsAuthEndpoints();
        apiGroup.MapExternalGoogleLoginEndpoints();
        apiGroup.MapExternalGitHubLoginEndpoints();
        apiGroup.MapLogoutEndpoint();
    }

    private static void ConfigureGoogleAuthentication(
        AuthenticationBuilder authenticationBuilder,
        string? clientId,
        string? clientSecret,
        CookieSecurePolicy cookieSecurePolicy,
        bool useSecureCookies)
    {
        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
        {
            return;
        }

        authenticationBuilder.AddGoogle(ExternalAuthDefaults.GoogleScheme, options =>
        {
            options.SignInScheme = ExternalAuthDefaults.ExternalScheme;
            options.ClientId = clientId;
            options.ClientSecret = clientSecret;
            options.CallbackPath = ExternalAuthDefaults.GoogleHandlerCallbackPath;
            ApplyCorrelationCookieSettings(options, cookieSecurePolicy, useSecureCookies);
        });
    }

    private static void ConfigureGitHubAuthentication(
        AuthenticationBuilder authenticationBuilder,
        string? clientId,
        string? clientSecret,
        CookieSecurePolicy cookieSecurePolicy,
        bool useSecureCookies)
    {
        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
        {
            return;
        }

        authenticationBuilder.AddOAuth(ExternalAuthDefaults.GitHubScheme, options =>
        {
            options.SignInScheme = ExternalAuthDefaults.ExternalScheme;
            options.ClientId = clientId;
            options.ClientSecret = clientSecret;
            options.CallbackPath = ExternalAuthDefaults.GitHubHandlerCallbackPath;
            options.AuthorizationEndpoint = "https://github.com/login/oauth/authorize";
            options.TokenEndpoint = "https://github.com/login/oauth/access_token";
            options.UserInformationEndpoint = "https://api.github.com/user";
            options.Scope.Add("read:user");
            options.Scope.Add("user:email");
            options.ClaimActions.MapJsonKey(ClaimTypes.NameIdentifier, "id");
            options.ClaimActions.MapJsonKey(ClaimTypes.Name, "name");
            options.ClaimActions.MapJsonKey(ClaimTypes.Email, "email");
            options.Events = new OAuthEvents
            {
                OnCreatingTicket = PopulateGitHubClaimsAsync
            };

            ApplyCorrelationCookieSettings(options, cookieSecurePolicy, useSecureCookies);
        });
    }

    private static async Task PopulateGitHubClaimsAsync(OAuthCreatingTicketContext context)
    {
        using var profilePayload = await FetchGitHubPayloadAsync(
            context,
            context.Options.UserInformationEndpoint,
            ensureSuccess: true)
            ?? throw new InvalidOperationException("GitHub user profile payload is empty.");

        context.RunClaimActions(profilePayload.RootElement);

        var hasEmail = context.Identity?.FindFirst(ClaimTypes.Email) is not null;
        if (hasEmail)
        {
            return;
        }

        var fallbackEmail = await ResolveGitHubEmailAsync(context);
        if (!string.IsNullOrWhiteSpace(fallbackEmail) && context.Identity is not null)
        {
            context.Identity.AddClaim(new Claim(ClaimTypes.Email, fallbackEmail));
        }
    }

    private static async Task<string?> ResolveGitHubEmailAsync(OAuthCreatingTicketContext context)
    {
        using var emailsPayload = await FetchGitHubPayloadAsync(
            context,
            "https://api.github.com/user/emails",
            ensureSuccess: false);

        if (emailsPayload is null || emailsPayload.RootElement.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        string? selectedEmail = null;

        foreach (var emailEntry in emailsPayload.RootElement.EnumerateArray())
        {
            var email = emailEntry.TryGetProperty("email", out var emailProperty)
                ? emailProperty.GetString()
                : null;
            if (string.IsNullOrWhiteSpace(email))
            {
                continue;
            }

            var verified = !emailEntry.TryGetProperty("verified", out var verifiedProperty)
                || verifiedProperty.GetBoolean();
            if (!verified)
            {
                continue;
            }

            selectedEmail = email;

            var isPrimary = emailEntry.TryGetProperty("primary", out var primaryProperty)
                && primaryProperty.GetBoolean();
            if (isPrimary)
            {
                break;
            }
        }

        return selectedEmail;
    }

    private static async Task<JsonDocument?> FetchGitHubPayloadAsync(
        OAuthCreatingTicketContext context,
        string endpoint,
        bool ensureSuccess)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", context.AccessToken);
        request.Headers.Accept.ParseAdd("application/vnd.github+json");
        request.Headers.Add("User-Agent", "Storo");

        using var response = await context.Backchannel.SendAsync(request, context.HttpContext.RequestAborted);
        if (ensureSuccess)
        {
            response.EnsureSuccessStatusCode();
        }
        else if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        await using var payloadStream = await response.Content.ReadAsStreamAsync(context.HttpContext.RequestAborted);
        return await JsonDocument.ParseAsync(payloadStream, cancellationToken: context.HttpContext.RequestAborted);
    }

    private static void ApplyCorrelationCookieSettings(
        OAuthOptions options,
        CookieSecurePolicy cookieSecurePolicy,
        bool useSecureCookies)
    {
        options.CorrelationCookie.SecurePolicy = cookieSecurePolicy;
        options.CorrelationCookie.SameSite = useSecureCookies
            ? SameSiteMode.None
            : SameSiteMode.Lax;
    }
}
