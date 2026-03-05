using System.Globalization;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Items.UseCases.ListInventoryItems;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Items.Api;

public static class InventoryItemsEndpoint
{
    private const int DefaultPage = 1;
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;

    public static void MapInventoryItemsEndpoint(this RouteGroupBuilder apiGroup)
    {
        apiGroup
            .MapGroup("/inventories/{inventoryId}/items")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status404NotFound))
            .MapGet(string.Empty, ListAsync)
            .WithName("ListInventoryItems")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ItemsTableResponse), StatusCodes.Status200OK));
    }

    private static async Task<Results<Ok<ItemsTableResponse>, ValidationProblem, NotFound<ProblemDetails>>> ListAsync(
        string inventoryId,
        [AsParameters] ListInventoryItemsRequest request,
        ICurrentUserAccessor currentUserAccessor,
        IListInventoryItemsUseCase useCase,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        var parsedInventoryId = ParseRequiredPositiveLong(inventoryId, "inventoryId", errors);
        var page = ParsePage(request.Page, errors);
        var pageSize = ParsePageSize(request.PageSize, errors);
        var sortField = ParseSortField(request.SortField, errors);
        var sortDirection = ParseSortDirection(request.SortDirection, errors);

        if (!parsedInventoryId.HasValue
            || !page.HasValue
            || !pageSize.HasValue
            || sortField is null
            || !sortDirection.HasValue
            || errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var currentUser = currentUserAccessor.CurrentUser;
        var viewerUserId = currentUser.IsAuthenticated ? currentUser.UserId : null;

        try
        {
            var result = await useCase.ExecuteAsync(
                new ListInventoryItemsQuery(
                    parsedInventoryId.Value,
                    page.Value,
                    pageSize.Value,
                    sortField,
                    sortDirection.Value,
                    viewerUserId),
                cancellationToken);

            return TypedResults.Ok(ItemsTableResponse.FromResult(result));
        }
        catch (InventoryItemsInventoryNotFoundException exception)
        {
            var problemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "Not Found",
                Detail = $"Inventory '{exception.InventoryId.ToString(CultureInfo.InvariantCulture)}' was not found.",
                Type = "https://httpstatuses.com/404"
            };

            problemDetails.Extensions["code"] = "inventory_not_found";
            return TypedResults.NotFound(problemDetails);
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

    private static int? ParsePage(int? rawValue, IDictionary<string, string[]> errors)
    {
        var page = rawValue ?? DefaultPage;
        if (page >= 1)
        {
            return page;
        }

        errors["page"] = ["page must be greater than or equal to 1."];
        return null;
    }

    private static int? ParsePageSize(int? rawValue, IDictionary<string, string[]> errors)
    {
        var pageSize = rawValue ?? DefaultPageSize;
        if (pageSize is >= 1 and <= MaxPageSize)
        {
            return pageSize;
        }

        errors["pageSize"] = [$"pageSize must be between 1 and {MaxPageSize}."];
        return null;
    }

    private static ItemsTableSortField? ParseSortField(string? rawValue, IDictionary<string, string[]> errors)
    {
        var value = string.IsNullOrWhiteSpace(rawValue) ? "updatedAt" : rawValue.Trim();

        if (string.Equals(value, "customId", StringComparison.OrdinalIgnoreCase))
        {
            return new ItemsTableSortField(ItemsTableSortFieldKind.CustomId);
        }

        if (string.Equals(value, "createdAt", StringComparison.OrdinalIgnoreCase))
        {
            return new ItemsTableSortField(ItemsTableSortFieldKind.CreatedAt);
        }

        if (string.Equals(value, "updatedAt", StringComparison.OrdinalIgnoreCase))
        {
            return new ItemsTableSortField(ItemsTableSortFieldKind.UpdatedAt);
        }

        const string fieldPrefix = "field:";
        if (value.StartsWith(fieldPrefix, StringComparison.OrdinalIgnoreCase))
        {
            var rawFieldId = value[fieldPrefix.Length..].Trim();
            if (long.TryParse(rawFieldId, NumberStyles.None, CultureInfo.InvariantCulture, out var parsedFieldId)
                && parsedFieldId > 0)
            {
                return new ItemsTableSortField(ItemsTableSortFieldKind.CustomField, parsedFieldId);
            }
        }

        errors["sortField"] = ["sortField must be one of: customId, createdAt, updatedAt, field:{fieldId}."];
        return null;
    }

    private static ItemsTableSortDirection? ParseSortDirection(
        string? rawValue,
        IDictionary<string, string[]> errors)
    {
        var value = string.IsNullOrWhiteSpace(rawValue) ? "desc" : rawValue.Trim();

        if (string.Equals(value, "asc", StringComparison.OrdinalIgnoreCase))
        {
            return ItemsTableSortDirection.Asc;
        }

        if (string.Equals(value, "desc", StringComparison.OrdinalIgnoreCase))
        {
            return ItemsTableSortDirection.Desc;
        }

        errors["sortDirection"] = ["sortDirection must be one of: asc, desc."];
        return null;
    }
}

public sealed record ListInventoryItemsRequest(
    [property: FromQuery(Name = "page")] int? Page,
    [property: FromQuery(Name = "pageSize")] int? PageSize,
    [property: FromQuery(Name = "sortField")] string? SortField,
    [property: FromQuery(Name = "sortDirection")] string? SortDirection);
