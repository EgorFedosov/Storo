using System.Globalization;
using System.Text.Json;
using backend.Modules.Auth.Api;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Items.UseCases.CreateItem;
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
    private const int MaxCustomIdLength = 500;

    public static void MapInventoryItemsEndpoint(this RouteGroupBuilder apiGroup)
    {
        var itemsGroup = apiGroup
            .MapGroup("/inventories/{inventoryId}/items")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status404NotFound));

        itemsGroup
            .MapPost(string.Empty, CreateAsync)
            .WithName("CreateInventoryItem")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ItemDetailsResponse), StatusCodes.Status201Created),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status401Unauthorized),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status403Forbidden),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status409Conflict))
            .RequireAuthenticatedAccess();

        itemsGroup
            .MapGet(string.Empty, ListAsync)
            .WithName("ListInventoryItems")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ItemsTableResponse), StatusCodes.Status200OK));
    }

    private static async Task<Results<Created<ItemDetailsResponse>, ValidationProblem, ProblemHttpResult>> CreateAsync(
        string inventoryId,
        CreateItemRequest request,
        ICurrentUserAccessor currentUserAccessor,
        ICreateItemUseCase useCase,
        IETagService eTagService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var parsedInventoryId = ParseRequiredPositiveLong(inventoryId, "inventoryId", errors);
        var customId = ParseCustomId(request.CustomId, errors);
        var fields = ParseFields(request.Fields, errors);

        if (!parsedInventoryId.HasValue || errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var currentUser = currentUserAccessor.CurrentUser;
        var actorUserId = currentUser.UserId
                          ?? throw new InvalidOperationException("Authenticated user id claim is missing.");

        try
        {
            var result = await useCase.ExecuteAsync(
                new CreateItemCommand(
                    parsedInventoryId.Value,
                    actorUserId,
                    HasAdminRole(currentUser.Roles),
                    customId,
                    fields),
                cancellationToken);

            var response = ItemDetailsResponse.FromResult(result);
            httpContext.Response.Headers.ETag = eTagService.ToETag(result.Version);
            var location = $"/api/v1/items/{response.Id}";
            return TypedResults.Created(location, response);
        }
        catch (ItemValidationException exception)
        {
            return TypedResults.ValidationProblem(ToMutableErrors(exception.Errors));
        }
        catch (ItemInventoryNotFoundException exception)
        {
            return CreateProblem(
                StatusCodes.Status404NotFound,
                "Not Found",
                $"Inventory '{exception.InventoryId.ToString(CultureInfo.InvariantCulture)}' was not found.",
                "inventory_not_found");
        }
        catch (CreateItemAccessDeniedException)
        {
            return CreateProblem(
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "You do not have permission to add items to this inventory.",
                "inventory_write_forbidden");
        }
        catch (ItemCustomIdConflictException exception)
        {
            return CreateProblem(
                StatusCodes.Status409Conflict,
                "Conflict",
                $"customId '{exception.CustomId}' already exists in this inventory.",
                "duplicate_custom_id");
        }
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

    private static string? ParseCustomId(string? rawValue, IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return null;
        }

        var value = rawValue.Trim();
        if (value.Length > MaxCustomIdLength)
        {
            errors["customId"] = [$"customId must be {MaxCustomIdLength} characters or less."];
        }

        return value;
    }

    private static IReadOnlyList<CreateItemFieldInput> ParseFields(
        IReadOnlyList<CreateItemFieldRequest>? rawFields,
        IDictionary<string, string[]> errors)
    {
        if (rawFields is null || rawFields.Count == 0)
        {
            return Array.Empty<CreateItemFieldInput>();
        }

        var parsedFields = new List<CreateItemFieldInput>(rawFields.Count);
        var seenFieldIds = new HashSet<long>();

        for (var i = 0; i < rawFields.Count; i++)
        {
            var fieldPath = $"fields[{i}]";
            var rawField = rawFields[i];

            if (string.IsNullOrWhiteSpace(rawField.FieldId)
                || !long.TryParse(rawField.FieldId.Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out var fieldId)
                || fieldId <= 0)
            {
                errors[$"{fieldPath}.fieldId"] = ["fieldId must be a positive integer string."];
                continue;
            }

            if (!seenFieldIds.Add(fieldId))
            {
                errors[$"{fieldPath}.fieldId"] = ["Duplicate fieldId is not allowed."];
                continue;
            }

            if (!TryParseFieldValue(rawField.Value, fieldPath, errors, out var parsedValue))
            {
                continue;
            }

            parsedFields.Add(new CreateItemFieldInput(
                i,
                fieldId,
                parsedValue.ValueKind,
                parsedValue.StringValue,
                parsedValue.NumberValue,
                parsedValue.BoolValue));
        }

        return parsedFields;
    }

    private static bool TryParseFieldValue(
        JsonElement? rawValue,
        string fieldPath,
        IDictionary<string, string[]> errors,
        out ParsedItemFieldValue parsedValue)
    {
        if (!rawValue.HasValue)
        {
            parsedValue = ParsedItemFieldValue.Null();
            return true;
        }

        var value = rawValue.Value;
        switch (value.ValueKind)
        {
            case JsonValueKind.Undefined:
            case JsonValueKind.Null:
                parsedValue = ParsedItemFieldValue.Null();
                return true;
            case JsonValueKind.String:
                parsedValue = ParsedItemFieldValue.String(value.GetString() ?? string.Empty);
                return true;
            case JsonValueKind.Number when value.TryGetDecimal(out var numberValue):
                parsedValue = ParsedItemFieldValue.Number(numberValue);
                return true;
            case JsonValueKind.True:
                parsedValue = ParsedItemFieldValue.Bool(true);
                return true;
            case JsonValueKind.False:
                parsedValue = ParsedItemFieldValue.Bool(false);
                return true;
            default:
                errors[$"{fieldPath}.value"] = ["value must be string, number, boolean, or null."];
                parsedValue = default;
                return false;
        }
    }

    private static bool HasAdminRole(IReadOnlyCollection<string> roles)
    {
        return roles.Any(role => string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase));
    }

    private static Dictionary<string, string[]> ToMutableErrors(IReadOnlyDictionary<string, string[]> errors)
    {
        return errors.ToDictionary(
            static pair => pair.Key,
            static pair => pair.Value,
            StringComparer.Ordinal);
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

    private readonly record struct ParsedItemFieldValue(
        ItemFieldValueKind ValueKind,
        string? StringValue,
        decimal? NumberValue,
        bool? BoolValue)
    {
        public static ParsedItemFieldValue Null() => new(ItemFieldValueKind.Null, null, null, null);

        public static ParsedItemFieldValue String(string value) => new(ItemFieldValueKind.String, value, null, null);

        public static ParsedItemFieldValue Number(decimal value) => new(ItemFieldValueKind.Number, null, value, null);

        public static ParsedItemFieldValue Bool(bool value) => new(ItemFieldValueKind.Bool, null, null, value);
    }
}

public sealed record CreateItemRequest(
    string? CustomId,
    IReadOnlyList<CreateItemFieldRequest>? Fields);

public sealed record CreateItemFieldRequest(
    string? FieldId,
    JsonElement? Value);

public sealed record ListInventoryItemsRequest(
    [property: FromQuery(Name = "page")] int? Page,
    [property: FromQuery(Name = "pageSize")] int? PageSize,
    [property: FromQuery(Name = "sortField")] string? SortField,
    [property: FromQuery(Name = "sortDirection")] string? SortDirection);
