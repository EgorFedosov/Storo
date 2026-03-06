using System.Globalization;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;
using backend.Modules.Inventories.UseCases.Statistics;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Inventories.Api;

public static class InventoryStatisticsEndpoint
{
    public static void MapInventoryStatisticsEndpoint(this RouteGroupBuilder apiGroup)
    {
        apiGroup
            .MapGet("/inventories/{inventoryId}/statistics", GetAsync)
            .WithName("GetInventoryStatistics")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(InventoryStatisticsResponse), StatusCodes.Status200OK),
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status404NotFound));
    }

    private static async Task<Results<Ok<InventoryStatisticsResponse>, ValidationProblem, NotFound<ProblemDetails>>> GetAsync(
        string inventoryId,
        IGetInventoryStatisticsUseCase useCase,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var parsedInventoryId = ParseRequiredPositiveLong(inventoryId, "inventoryId", errors);

        if (!parsedInventoryId.HasValue || errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        try
        {
            var result = await useCase.ExecuteAsync(
                new GetInventoryStatisticsQuery(parsedInventoryId.Value),
                cancellationToken);

            return TypedResults.Ok(InventoryStatisticsResponse.FromResult(result));
        }
        catch (InventoryNotFoundException exception)
        {
            return CreateInventoryNotFoundResult(exception.InventoryId);
        }
    }

    private static long? ParseRequiredPositiveLong(
        string rawValue,
        string fieldName,
        IDictionary<string, string[]> errors)
    {
        if (long.TryParse(rawValue, NumberStyles.None, CultureInfo.InvariantCulture, out var parsedValue)
            && parsedValue > 0)
        {
            return parsedValue;
        }

        errors[fieldName] = [$"{fieldName} must be a positive integer."];
        return null;
    }

    private static NotFound<ProblemDetails> CreateInventoryNotFoundResult(long inventoryId)
    {
        var problemDetails = new ProblemDetails
        {
            Status = StatusCodes.Status404NotFound,
            Title = "Not Found",
            Detail = $"Inventory '{inventoryId.ToString(CultureInfo.InvariantCulture)}' was not found.",
            Type = "https://httpstatuses.com/404"
        };

        problemDetails.Extensions["code"] = "inventory_not_found";
        return TypedResults.NotFound(problemDetails);
    }
}
