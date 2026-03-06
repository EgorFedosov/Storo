using System.Globalization;
using System.Text.Json;
using backend.Modules.Auth.Api;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Concurrency.Api;
using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Items.UseCases.CreateItem;
using backend.Modules.Items.UseCases.DeleteItem;
using backend.Modules.Items.UseCases.GetItemDetails;
using backend.Modules.Items.UseCases.ItemLifecycle;
using backend.Modules.Items.UseCases.UpdateItem;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Items.Api;

public static class ItemLifecycleEndpoint
{
    private const int MaxCustomIdLength = 500;

    public static void MapItemLifecycleEndpoint(this RouteGroupBuilder apiGroup)
    {
        var itemsGroup = apiGroup
            .MapGroup("/items/{itemId}")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status404NotFound));

        itemsGroup
            .MapGet(string.Empty, GetAsync)
            .WithName("GetItemDetails")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ItemDetailsResponse), StatusCodes.Status200OK));

        itemsGroup
            .MapPut(string.Empty, UpdateAsync)
            .WithName("UpdateItem")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ItemDetailsResponse), StatusCodes.Status200OK),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status401Unauthorized),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status403Forbidden),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status409Conflict))
            .RequireAuthenticatedAccess()
            .RequireIfMatch();

        itemsGroup
            .MapDelete(string.Empty, DeleteAsync)
            .WithName("DeleteItem")
            .WithMetadata(
                new ProducesResponseTypeAttribute(StatusCodes.Status204NoContent),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status401Unauthorized),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status403Forbidden))
            .RequireAuthenticatedAccess()
            .RequireIfMatch();
    }

    private static async Task<Results<Ok<ItemDetailsResponse>, ValidationProblem, NotFound<ProblemDetails>>> GetAsync(
        string itemId,
        ICurrentUserAccessor currentUserAccessor,
        IGetItemDetailsUseCase useCase,
        IETagService eTagService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var parsedItemId = ParseRequiredPositiveLong(itemId, "itemId", errors);
        if (!parsedItemId.HasValue)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var currentUser = currentUserAccessor.CurrentUser;

        try
        {
            var result = await useCase.ExecuteAsync(
                new GetItemDetailsQuery(
                    parsedItemId.Value,
                    new ItemViewerContext(
                        currentUser.UserId,
                        currentUser.IsAuthenticated,
                        currentUser.IsBlocked,
                        HasAdminRole(currentUser.Roles))),
                cancellationToken);

            httpContext.Response.Headers.ETag = eTagService.ToETag(result.Version);
            return TypedResults.Ok(ItemDetailsResponse.FromResult(result));
        }
        catch (ItemNotFoundException exception)
        {
            var problemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "Not Found",
                Detail = $"Item '{exception.ItemId.ToString(CultureInfo.InvariantCulture)}' was not found.",
                Type = "https://httpstatuses.com/404"
            };

            problemDetails.Extensions["code"] = "item_not_found";
            return TypedResults.NotFound(problemDetails);
        }
    }

    private static async Task<Results<Ok<ItemDetailsResponse>, ValidationProblem, ProblemHttpResult>> UpdateAsync(
        string itemId,
        UpdateItemRequest request,
        ICurrentUserAccessor currentUserAccessor,
        IUpdateItemUseCase useCase,
        IETagService eTagService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var parsedItemId = ParseRequiredPositiveLong(itemId, "itemId", errors);
        var customId = ParseRequiredCustomId(request.CustomId, errors);
        var fields = ParseFields(request.Fields, errors);

        if (!parsedItemId.HasValue || customId is null || errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var currentUser = currentUserAccessor.CurrentUser;
        var actorUserId = currentUser.UserId
                          ?? throw new InvalidOperationException("Authenticated user id claim is missing.");

        try
        {
            var result = await useCase.ExecuteAsync(
                new UpdateItemCommand(
                    parsedItemId.Value,
                    actorUserId,
                    HasAdminRole(currentUser.Roles),
                    httpContext.GetIfMatchToken(),
                    customId,
                    fields),
                cancellationToken);

            httpContext.Response.Headers.ETag = eTagService.ToETag(result.Version);
            return TypedResults.Ok(ItemDetailsResponse.FromResult(result));
        }
        catch (ItemValidationException exception)
        {
            return TypedResults.ValidationProblem(ToMutableErrors(exception.Errors));
        }
        catch (ItemNotFoundException exception)
        {
            return CreateProblem(
                StatusCodes.Status404NotFound,
                "Not Found",
                $"Item '{exception.ItemId.ToString(CultureInfo.InvariantCulture)}' was not found.",
                "item_not_found");
        }
        catch (ItemWriteAccessDeniedException)
        {
            return CreateProblem(
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "You do not have permission to modify this item.",
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

    private static async Task<Results<NoContent, ValidationProblem, ProblemHttpResult>> DeleteAsync(
        string itemId,
        ICurrentUserAccessor currentUserAccessor,
        IDeleteItemUseCase useCase,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var parsedItemId = ParseRequiredPositiveLong(itemId, "itemId", errors);
        if (!parsedItemId.HasValue)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var currentUser = currentUserAccessor.CurrentUser;
        var actorUserId = currentUser.UserId
                          ?? throw new InvalidOperationException("Authenticated user id claim is missing.");

        try
        {
            await useCase.ExecuteAsync(
                new DeleteItemCommand(
                    parsedItemId.Value,
                    actorUserId,
                    HasAdminRole(currentUser.Roles),
                    httpContext.GetIfMatchToken()),
                cancellationToken);

            return TypedResults.NoContent();
        }
        catch (ItemNotFoundException exception)
        {
            return CreateProblem(
                StatusCodes.Status404NotFound,
                "Not Found",
                $"Item '{exception.ItemId.ToString(CultureInfo.InvariantCulture)}' was not found.",
                "item_not_found");
        }
        catch (ItemWriteAccessDeniedException)
        {
            return CreateProblem(
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "You do not have permission to modify this item.",
                "inventory_write_forbidden");
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

    private static string? ParseRequiredCustomId(
        string? rawValue,
        IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            errors["customId"] = ["customId is required."];
            return null;
        }

        var customId = rawValue.Trim();
        if (customId.Length > MaxCustomIdLength)
        {
            errors["customId"] = [$"customId must be {MaxCustomIdLength} characters or less."];
            return null;
        }

        return customId;
    }

    private static IReadOnlyList<CreateItemFieldInput> ParseFields(
        IReadOnlyList<UpdateItemFieldRequest>? rawFields,
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

    private static Dictionary<string, string[]> ToMutableErrors(IReadOnlyDictionary<string, string[]> errors)
    {
        return errors.ToDictionary(
            static pair => pair.Key,
            static pair => pair.Value,
            StringComparer.Ordinal);
    }

    private static bool HasAdminRole(IReadOnlyCollection<string> roles)
    {
        return roles.Any(role => string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase));
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

public sealed record UpdateItemRequest(
    string? CustomId,
    IReadOnlyList<UpdateItemFieldRequest>? Fields);

public sealed record UpdateItemFieldRequest(
    string? FieldId,
    JsonElement? Value);
