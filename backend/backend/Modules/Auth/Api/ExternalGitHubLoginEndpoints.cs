using backend.Modules.Auth.UseCases.ExternalLogin;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Auth.Api;

public static class ExternalGitHubLoginEndpoints
{
    public static void MapExternalGitHubLoginEndpoints(this RouteGroupBuilder apiGroup)
    {
        apiGroup
            .MapGet(
                "/auth/external/github/start",
                StartAsync)
            .WithName("StartGitHubLogin")
            .AllowAnonymous();

        apiGroup
            .MapGet(
                "/auth/external/github/callback",
                CompleteAsync)
            .WithName("CompleteGitHubLogin")
            .AllowAnonymous();
    }

    private static async Task<Results<ChallengeHttpResult, RedirectHttpResult>> StartAsync(
        [AsParameters] StartGitHubLoginRequest request,
        IStartGitHubLoginUseCase useCase,
        CancellationToken cancellationToken)
    {
        var command = new StartGitHubLoginCommand(request.ReturnUrl);
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
        [AsParameters] CompleteGitHubLoginRequest request,
        ICompleteGitHubLoginUseCase useCase,
        CancellationToken cancellationToken)
    {
        var command = new CompleteGitHubLoginCommand(
            request.State,
            request.Code,
            request.Error,
            request.ErrorDescription,
            request.ReturnUrl);

        var result = await useCase.ExecuteAsync(command, cancellationToken);
        return TypedResults.Redirect(result.RedirectUri);
    }
}

public sealed record StartGitHubLoginRequest(
    [property: FromQuery(Name = "returnUrl")] string? ReturnUrl);

public sealed record CompleteGitHubLoginRequest(
    [property: FromQuery(Name = "state")] string? State,
    [property: FromQuery(Name = "code")] string? Code,
    [property: FromQuery(Name = "error")] string? Error,
    [property: FromQuery(Name = "error_description")] string? ErrorDescription,
    [property: FromQuery(Name = "returnUrl")] string? ReturnUrl);
