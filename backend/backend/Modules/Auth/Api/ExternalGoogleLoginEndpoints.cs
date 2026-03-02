using backend.Modules.Auth.UseCases.ExternalLogin;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Auth.Api;

public static class ExternalGoogleLoginEndpoints
{
    public static void MapExternalGoogleLoginEndpoints(this RouteGroupBuilder apiGroup)
    {
        apiGroup
            .MapGet(
                "/auth/external/google/start",
                StartAsync)
            .WithName("StartGoogleLogin")
            .AllowAnonymous();

        apiGroup
            .MapGet(
                "/auth/external/google/callback",
                CompleteAsync)
            .WithName("CompleteGoogleLogin")
            .AllowAnonymous();
    }

    private static async Task<Results<ChallengeHttpResult, RedirectHttpResult>> StartAsync(
        [AsParameters] StartGoogleLoginRequest request,
        IStartGoogleLoginUseCase useCase,
        CancellationToken cancellationToken)
    {
        var command = new StartGoogleLoginCommand(request.ReturnUrl);
        var result = await useCase.ExecuteAsync(command, cancellationToken);

        if (result.Status == AuthSessionStatus.Challenge && result.Challenge is not null)
        {
            return TypedResults.Challenge(
                result.Challenge.Properties,
                authenticationSchemes: [result.Challenge.Scheme]);
        }

        return TypedResults.Redirect(result.RedirectUri);
    }

    private static async Task<RedirectHttpResult> CompleteAsync(
        [AsParameters] CompleteGoogleLoginRequest request,
        ICompleteGoogleLoginUseCase useCase,
        CancellationToken cancellationToken)
    {
        var command = new CompleteGoogleLoginCommand(
            request.State,
            request.Code,
            request.Error,
            request.ErrorDescription,
            request.ReturnUrl);

        var result = await useCase.ExecuteAsync(command, cancellationToken);
        return TypedResults.Redirect(result.RedirectUri);
    }
}

public sealed record StartGoogleLoginRequest(
    [property: FromQuery(Name = "returnUrl")] string? ReturnUrl);

public sealed record CompleteGoogleLoginRequest(
    [property: FromQuery(Name = "state")] string? State,
    [property: FromQuery(Name = "code")] string? Code,
    [property: FromQuery(Name = "error")] string? Error,
    [property: FromQuery(Name = "error_description")] string? ErrorDescription,
    [property: FromQuery(Name = "returnUrl")] string? ReturnUrl);
