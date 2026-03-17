using System.Globalization;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;
using backend.Modules.Inventories.UseCases.OdooExport;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Inventories.Api;

public static class InventoryOdooExportEndpoint
{
    private const string InventoryApiTokenHeaderName = "X-Inventory-Api-Token";

    public static void MapInventoryOdooExportEndpoint(this RouteGroupBuilder apiGroup)
    {
        apiGroup
            .MapGet("/integrations/odoo/export", ExportAsync)
            .WithName("ExportInventoryForOdoo")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(InventoryOdooExportResponse), StatusCodes.Status200OK),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status401Unauthorized),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status404NotFound));
    }

    private static async Task<Results<Ok<InventoryOdooExportResponse>, ProblemHttpResult>> ExportAsync(
        [FromHeader(Name = InventoryApiTokenHeaderName)] string? inventoryApiToken,
        IExportInventoryForOdooUseCase useCase,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await useCase.ExecuteAsync(
                new ExportInventoryForOdooQuery(inventoryApiToken),
                cancellationToken);

            return TypedResults.Ok(InventoryOdooExportResponse.FromResult(result));
        }
        catch (OdooExportUnauthorizedException)
        {
            return CreateProblem(
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                "X-Inventory-Api-Token is missing, invalid, or inactive.",
                "inventory_api_token_invalid");
        }
        catch (InventoryNotFoundException exception)
        {
            return CreateProblem(
                StatusCodes.Status404NotFound,
                "Not Found",
                $"Inventory '{exception.InventoryId.ToString(CultureInfo.InvariantCulture)}' was not found.",
                "inventory_not_found");
        }
    }

    private static ProblemHttpResult CreateProblem(
        int statusCode,
        string title,
        string detail,
        string code)
    {
        return TypedResults.Problem(
            statusCode: statusCode,
            title: title,
            detail: detail,
            type: $"https://httpstatuses.com/{statusCode.ToString(CultureInfo.InvariantCulture)}",
            extensions: new Dictionary<string, object?>
            {
                ["code"] = code
            });
    }
}

public sealed record InventoryOdooExportResponse(
    InventoryOdooExportInventoryResponse Inventory,
    IReadOnlyList<InventoryOdooExportFieldResponse> Fields,
    InventoryOdooExportAggregatesResponse Aggregates,
    InventoryOdooExportSourceResponse Source)
{
    public static InventoryOdooExportResponse FromResult(ExportInventoryForOdooResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new InventoryOdooExportResponse(
            new InventoryOdooExportInventoryResponse(
                result.Inventory.Id.ToString(CultureInfo.InvariantCulture),
                result.Inventory.Title,
                result.Inventory.Category,
                result.Inventory.IsPublic,
                result.Inventory.UpdatedAt),
            result.Fields
                .Select(field => new InventoryOdooExportFieldResponse(
                    field.FieldId.ToString(CultureInfo.InvariantCulture),
                    field.Title,
                    field.Type,
                    field.ShowInTable))
                .ToArray(),
            new InventoryOdooExportAggregatesResponse(
                result.Aggregates.ItemsCount,
                result.Aggregates.Numeric
                    .Select(statistic => new InventoryOdooExportNumericAggregateResponse(
                        statistic.FieldId.ToString(CultureInfo.InvariantCulture),
                        statistic.Title,
                        statistic.Min,
                        statistic.Max,
                        statistic.Avg))
                    .ToArray(),
                result.Aggregates.String
                    .Select(statistic => new InventoryOdooExportStringAggregateResponse(
                        statistic.FieldId.ToString(CultureInfo.InvariantCulture),
                        statistic.Title,
                        statistic.MostFrequentValue,
                        statistic.MostFrequentCount))
                    .ToArray()),
            new InventoryOdooExportSourceResponse(
                result.Source.SchemaVersion,
                result.Source.GeneratedAt));
    }
}

public sealed record InventoryOdooExportInventoryResponse(
    string Id,
    string Title,
    string Category,
    bool IsPublic,
    DateTime UpdatedAt);

public sealed record InventoryOdooExportFieldResponse(
    string FieldId,
    string Title,
    string Type,
    bool ShowInTable);

public sealed record InventoryOdooExportAggregatesResponse(
    int ItemsCount,
    IReadOnlyList<InventoryOdooExportNumericAggregateResponse> Numeric,
    IReadOnlyList<InventoryOdooExportStringAggregateResponse> String);

public sealed record InventoryOdooExportNumericAggregateResponse(
    string FieldId,
    string Title,
    decimal? Min,
    decimal? Max,
    decimal? Avg);

public sealed record InventoryOdooExportStringAggregateResponse(
    string FieldId,
    string Title,
    string? MostFrequentValue,
    int MostFrequentCount);

public sealed record InventoryOdooExportSourceResponse(
    int SchemaVersion,
    DateTime GeneratedAt);
