using backend.Modules.Auth.Api;
using backend.Modules.Users.UseCases.ListCurrentUserInventories;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Users.Api;

public static class UserInventoriesEndpoint
{
    private const int DefaultPage = 1;
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;

    public static void MapUserInventoriesEndpoint(this RouteGroupBuilder apiGroup)
    {
        apiGroup
            .MapGet("/users/me/inventories", ListAsync)
            .WithName("ListCurrentUserInventories")
            .RequireAuthenticatedAccess();
    }

    private static async Task<Results<Ok<UserInventoriesResponse>, ValidationProblem>> ListAsync(
        [AsParameters] ListCurrentUserInventoriesRequest request,
        IListCurrentUserInventoriesUseCase useCase,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        var relation = ParseRelation(request.Relation, errors);
        var sortField = ParseSortField(request.SortField, errors);
        var sortDirection = ParseSortDirection(request.SortDirection, errors);
        var page = ParsePage(request.Page, errors);
        var pageSize = ParsePageSize(request.PageSize, errors);

        if (errors.Count > 0
            || relation is null
            || sortField is null
            || sortDirection is null
            || page is null
            || pageSize is null)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var query = new ListCurrentUserInventoriesQuery(
            relation.Value,
            request.Query,
            page.Value,
            pageSize.Value,
            sortField.Value,
            sortDirection.Value);

        var result = await useCase.ExecuteAsync(query, cancellationToken);
        return TypedResults.Ok(UserInventoriesResponse.FromResult(result));
    }

    private static InventoryRelation? ParseRelation(string? rawValue, IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            errors["relation"] = ["relation is required and must be one of: owned, writable."];
            return null;
        }

        var value = rawValue.Trim();
        if (string.Equals(value, "owned", StringComparison.OrdinalIgnoreCase))
        {
            return InventoryRelation.Owned;
        }

        if (string.Equals(value, "writable", StringComparison.OrdinalIgnoreCase))
        {
            return InventoryRelation.Writable;
        }

        errors["relation"] = ["relation must be one of: owned, writable."];
        return null;
    }

    private static InventoryTableSortField? ParseSortField(string? rawValue, IDictionary<string, string[]> errors)
    {
        var value = string.IsNullOrWhiteSpace(rawValue) ? "updatedAt" : rawValue.Trim();

        if (string.Equals(value, "updatedAt", StringComparison.OrdinalIgnoreCase))
        {
            return InventoryTableSortField.UpdatedAt;
        }

        if (string.Equals(value, "createdAt", StringComparison.OrdinalIgnoreCase))
        {
            return InventoryTableSortField.CreatedAt;
        }

        if (string.Equals(value, "title", StringComparison.OrdinalIgnoreCase))
        {
            return InventoryTableSortField.Title;
        }

        if (string.Equals(value, "itemsCount", StringComparison.OrdinalIgnoreCase))
        {
            return InventoryTableSortField.ItemsCount;
        }

        errors["sortField"] = ["sortField must be one of: updatedAt, createdAt, title, itemsCount."];
        return null;
    }

    private static InventoryTableSortDirection? ParseSortDirection(
        string? rawValue,
        IDictionary<string, string[]> errors)
    {
        var value = string.IsNullOrWhiteSpace(rawValue) ? "desc" : rawValue.Trim();

        if (string.Equals(value, "asc", StringComparison.OrdinalIgnoreCase))
        {
            return InventoryTableSortDirection.Asc;
        }

        if (string.Equals(value, "desc", StringComparison.OrdinalIgnoreCase))
        {
            return InventoryTableSortDirection.Desc;
        }

        errors["sortDirection"] = ["sortDirection must be one of: asc, desc."];
        return null;
    }

    private static int? ParsePage(int? rawValue, IDictionary<string, string[]> errors)
    {
        var value = rawValue ?? DefaultPage;
        if (value >= 1)
        {
            return value;
        }

        errors["page"] = ["page must be greater than or equal to 1."];
        return null;
    }

    private static int? ParsePageSize(int? rawValue, IDictionary<string, string[]> errors)
    {
        var value = rawValue ?? DefaultPageSize;
        if (value is >= 1 and <= MaxPageSize)
        {
            return value;
        }

        errors["pageSize"] = [$"pageSize must be between 1 and {MaxPageSize}."];
        return null;
    }
}

public sealed record ListCurrentUserInventoriesRequest(
    [property: FromQuery(Name = "relation")] string? Relation,
    [property: FromQuery(Name = "query")] string? Query,
    [property: FromQuery(Name = "sortField")] string? SortField,
    [property: FromQuery(Name = "sortDirection")] string? SortDirection,
    [property: FromQuery(Name = "page")] int? Page,
    [property: FromQuery(Name = "pageSize")] int? PageSize);
