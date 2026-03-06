using backend.Modules.Search.UseCases.SearchInventories;
using backend.Modules.Search.UseCases.SearchItems;
using backend.Modules.Search.UseCases.Shared;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Search.Api;

public static class SearchEndpoints
{
    private const int DefaultPage = 1;
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;
    private const int MaxQueryLength = 500;
    private const int MaxTagLength = 100;

    public static void MapSearchEndpoints(this RouteGroupBuilder apiGroup)
    {
        var searchGroup = apiGroup
            .MapGroup("/search")
            .WithMetadata(new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest));

        searchGroup
            .MapGet("/inventories", SearchInventoriesAsync)
            .WithName("SearchInventories")
            .WithMetadata(new ProducesResponseTypeAttribute(typeof(SearchInventoriesResponse), StatusCodes.Status200OK));

        searchGroup
            .MapGet("/items", SearchItemsAsync)
            .WithName("SearchItems")
            .WithMetadata(new ProducesResponseTypeAttribute(typeof(SearchItemsResponse), StatusCodes.Status200OK));
    }

    private static async Task<Results<Ok<SearchInventoriesResponse>, ValidationProblem>> SearchInventoriesAsync(
        [AsParameters] SearchInventoriesRequest request,
        ISearchInventoriesUseCase useCase,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        var query = ParseOptionalQuery(request.Query, "q", errors);
        var tag = ParseOptionalTag(request.Tag, errors);
        var page = ParsePage(request.Page, errors);
        var pageSize = ParsePageSize(request.PageSize, errors);
        var sort = ParseInventorySort(request.Sort, errors);

        if (query is null && tag is null)
        {
            errors["q"] = ["q is required when tag is not provided."];
        }

        if (errors.Count > 0
            || page is null
            || pageSize is null
            || sort is null)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var result = await useCase.ExecuteAsync(
            new SearchInventoriesQuery(
                query,
                tag,
                page.Value,
                pageSize.Value,
                sort.Value.Field,
                sort.Value.Direction),
            cancellationToken);

        return TypedResults.Ok(SearchInventoriesResponse.FromResult(result));
    }

    private static async Task<Results<Ok<SearchItemsResponse>, ValidationProblem>> SearchItemsAsync(
        [AsParameters] SearchItemsRequest request,
        ISearchItemsUseCase useCase,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        var query = ParseRequiredQuery(request.Query, errors);
        var page = ParsePage(request.Page, errors);
        var pageSize = ParsePageSize(request.PageSize, errors);
        var sort = ParseItemSort(request.Sort, errors);

        if (errors.Count > 0
            || query is null
            || page is null
            || pageSize is null
            || sort is null)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var result = await useCase.ExecuteAsync(
            new SearchItemsQuery(
                query,
                page.Value,
                pageSize.Value,
                sort.Value.Field,
                sort.Value.Direction),
            cancellationToken);

        return TypedResults.Ok(SearchItemsResponse.FromResult(result));
    }

    private static string? ParseOptionalQuery(
        string? rawValue,
        string fieldName,
        IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return null;
        }

        var value = rawValue.Trim();
        if (value.Length > MaxQueryLength)
        {
            errors[fieldName] = [$"{fieldName} must be {MaxQueryLength} characters or less."];
            return null;
        }

        return value;
    }

    private static string? ParseRequiredQuery(string? rawValue, IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            errors["q"] = ["q is required."];
            return null;
        }

        return ParseOptionalQuery(rawValue, "q", errors);
    }

    private static string? ParseOptionalTag(string? rawValue, IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return null;
        }

        var value = rawValue.Trim();
        if (value.Length > MaxTagLength)
        {
            errors["tag"] = [$"tag must be {MaxTagLength} characters or less."];
            return null;
        }

        return value;
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

    private static (SearchInventoriesSortField Field, SearchSortDirection Direction)? ParseInventorySort(
        string? rawValue,
        IDictionary<string, string[]> errors)
    {
        var (rawField, rawDirection) = ParseSort(rawValue, "relevance:desc");

        SearchInventoriesSortField? field = rawField switch
        {
            "relevance" => SearchInventoriesSortField.Relevance,
            "updatedat" => SearchInventoriesSortField.UpdatedAt,
            "createdat" => SearchInventoriesSortField.CreatedAt,
            "title" => SearchInventoriesSortField.Title,
            _ => null
        };

        if (field is null)
        {
            errors["sort"] = ["sort must be one of: relevance[:asc|desc], updatedAt[:asc|desc], createdAt[:asc|desc], title[:asc|desc]."];
            return null;
        }

        var direction = ParseDirection(rawDirection, errors);
        if (direction is null)
        {
            return null;
        }

        return (field.Value, direction.Value);
    }

    private static (SearchItemsSortField Field, SearchSortDirection Direction)? ParseItemSort(
        string? rawValue,
        IDictionary<string, string[]> errors)
    {
        var (rawField, rawDirection) = ParseSort(rawValue, "relevance:desc");

        SearchItemsSortField? field = rawField switch
        {
            "relevance" => SearchItemsSortField.Relevance,
            "updatedat" => SearchItemsSortField.UpdatedAt,
            "createdat" => SearchItemsSortField.CreatedAt,
            "customid" => SearchItemsSortField.CustomId,
            _ => null
        };

        if (field is null)
        {
            errors["sort"] = ["sort must be one of: relevance[:asc|desc], updatedAt[:asc|desc], createdAt[:asc|desc], customId[:asc|desc]."];
            return null;
        }

        var direction = ParseDirection(rawDirection, errors);
        if (direction is null)
        {
            return null;
        }

        return (field.Value, direction.Value);
    }

    private static (string Field, string Direction) ParseSort(string? rawValue, string defaultValue)
    {
        var value = string.IsNullOrWhiteSpace(rawValue) ? defaultValue : rawValue.Trim();
        var parts = value.Split(':', 2, StringSplitOptions.TrimEntries);

        var field = parts[0].ToLowerInvariant();
        var direction = parts.Length == 2
            ? parts[1].ToLowerInvariant()
            : "desc";

        return (field, direction);
    }

    private static SearchSortDirection? ParseDirection(string rawValue, IDictionary<string, string[]> errors)
    {
        if (string.Equals(rawValue, "asc", StringComparison.OrdinalIgnoreCase))
        {
            return SearchSortDirection.Asc;
        }

        if (string.Equals(rawValue, "desc", StringComparison.OrdinalIgnoreCase))
        {
            return SearchSortDirection.Desc;
        }

        errors["sort"] = ["sort direction must be one of: asc, desc."];
        return null;
    }
}

public sealed record SearchInventoriesRequest(
    [property: FromQuery(Name = "q")] string? Query,
    [property: FromQuery(Name = "tag")] string? Tag,
    [property: FromQuery(Name = "page")] int? Page,
    [property: FromQuery(Name = "pageSize")] int? PageSize,
    [property: FromQuery(Name = "sort")] string? Sort);

public sealed record SearchItemsRequest(
    [property: FromQuery(Name = "q")] string? Query,
    [property: FromQuery(Name = "page")] int? Page,
    [property: FromQuery(Name = "pageSize")] int? PageSize,
    [property: FromQuery(Name = "sort")] string? Sort);
