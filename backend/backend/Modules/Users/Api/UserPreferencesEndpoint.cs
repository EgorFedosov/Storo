using backend.Modules.Auth.Api;
using backend.Modules.Users.UseCases.Preferences;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Users.Api;

public static class UserPreferencesEndpoint
{
    private const int MaxLanguageLength = 10;
    private static readonly string[] AllowedThemes = ["light", "dark"];

    public static void MapUserPreferencesEndpoint(this RouteGroupBuilder apiGroup)
    {
        apiGroup
            .MapPatch(
                "/users/me/preferences",
                HandleAsync)
            .WithName("UpdateCurrentUserPreferences")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest))
            .RequireAuthenticatedAccess();
    }

    private static async Task<Results<Ok<UserPreferencesResponse>, ValidationProblem>> HandleAsync(
        UpdatePreferencesRequest request,
        IUpdateCurrentUserPreferencesUseCase useCase,
        CancellationToken cancellationToken)
    {
        var errors = ValidateRequest(request);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var command = new UpdateCurrentUserPreferencesCommand(
            request.Language!.Trim(),
            request.Theme!.Trim());

        var result = await useCase.ExecuteAsync(command, cancellationToken);
        return TypedResults.Ok(UserPreferencesResponse.FromResult(result));
    }

    private static Dictionary<string, string[]> ValidateRequest(UpdatePreferencesRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        if (string.IsNullOrWhiteSpace(request.Language))
        {
            errors["language"] = ["Language is required."];
        }
        else if (request.Language.Trim().Length > MaxLanguageLength)
        {
            errors["language"] = [$"Language must be {MaxLanguageLength} characters or less."];
        }

        if (string.IsNullOrWhiteSpace(request.Theme))
        {
            errors["theme"] = ["Theme is required."];
        }
        else if (!AllowedThemes.Contains(request.Theme.Trim(), StringComparer.OrdinalIgnoreCase))
        {
            errors["theme"] = [$"Theme must be one of: {string.Join(", ", AllowedThemes)}."];
        }

        return errors;
    }
}
