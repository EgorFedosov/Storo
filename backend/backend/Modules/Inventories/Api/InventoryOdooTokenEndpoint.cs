using System.Globalization;
using backend.Modules.Auth.Api;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;
using backend.Modules.Inventories.UseCases.OdooToken;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Inventories.Api;

public static class InventoryOdooTokenEndpoint
{
    public static void MapInventoryOdooTokenEndpoint(this RouteGroupBuilder apiGroup)
    {
        var odooGroup = apiGroup
            .MapGroup("/integrations/odoo")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status401Unauthorized),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status403Forbidden),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status409Conflict),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status404NotFound));

        odooGroup
            .MapPost("/inventories/{inventoryId}/token", GenerateTokenAsync)
            .WithName("GenerateInventoryOdooApiToken")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(InventoryOdooTokenResponse), StatusCodes.Status200OK))
            .RequireAuthenticatedAccess();
    }

    private static async Task<Results<Ok<InventoryOdooTokenResponse>, ValidationProblem, ProblemHttpResult>> GenerateTokenAsync(
        string inventoryId,
        ICurrentUserAccessor currentUserAccessor,
        IGenerateInventoryApiTokenUseCase useCase,
        CancellationToken cancellationToken)
    {
        if (!TryParseInventoryId(inventoryId, out var parsedInventoryId, out var validationProblem))
        {
            return validationProblem;
        }

        var currentUser = currentUserAccessor.CurrentUser;
        var actorUserId = currentUser.UserId
                          ?? throw new InvalidOperationException("Authenticated user id claim is missing.");

        try
        {
            var result = await useCase.ExecuteAsync(
                new GenerateInventoryApiTokenCommand(
                    parsedInventoryId,
                    actorUserId,
                    HasAdminRole(currentUser.Roles)),
                cancellationToken);

            return TypedResults.Ok(InventoryOdooTokenResponse.FromResult(result));
        }
        catch (InventoryNotFoundException exception)
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Not Found",
                detail: $"Inventory '{exception.InventoryId.ToString(CultureInfo.InvariantCulture)}' was not found.",
                type: "https://httpstatuses.com/404",
                extensions: new Dictionary<string, object?>
                {
                    ["code"] = "inventory_not_found"
                });
        }
        catch (InventoryApiTokenGenerationAccessDeniedException)
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status403Forbidden,
                title: "Forbidden",
                detail: "You do not have permission to generate API token for this inventory.",
                type: "https://httpstatuses.com/403",
                extensions: new Dictionary<string, object?>
                {
                    ["code"] = "inventory_token_generation_forbidden"
                });
        }
        catch (InventoryApiTokenGenerationConflictException)
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Conflict",
                detail: "API token was updated concurrently. Refresh inventory data and try again.",
                type: "https://httpstatuses.com/409",
                extensions: new Dictionary<string, object?>
                {
                    ["code"] = "inventory_token_conflict"
                });
        }
    }

    private static bool TryParseInventoryId(
        string rawInventoryId,
        out long inventoryId,
        out ValidationProblem validationProblem)
    {
        if (long.TryParse(rawInventoryId, NumberStyles.None, CultureInfo.InvariantCulture, out inventoryId)
            && inventoryId > 0)
        {
            validationProblem = null!;
            return true;
        }

        validationProblem = TypedResults.ValidationProblem(new Dictionary<string, string[]>
        {
            ["inventoryId"] = ["inventoryId must be a positive integer."]
        });

        return false;
    }

    private static bool HasAdminRole(IReadOnlyCollection<string> roles)
    {
        return roles.Any(role => string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase));
    }
}

public sealed record InventoryOdooTokenResponse(
    string InventoryId,
    string PlainToken,
    string MaskedToken,
    DateTime CreatedAt)
{
    public static InventoryOdooTokenResponse FromResult(GenerateInventoryApiTokenResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new InventoryOdooTokenResponse(
            result.InventoryId.ToString(CultureInfo.InvariantCulture),
            result.PlainToken,
            result.MaskedToken,
            result.CreatedAt);
    }
}
