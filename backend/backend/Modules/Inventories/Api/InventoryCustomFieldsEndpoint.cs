using System.Globalization;
using backend.Modules.Auth.Api;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Concurrency.Api;
using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Inventories.Domain;
using backend.Modules.Inventories.UseCases.EditorMutations;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Inventories.Api;

public static class InventoryCustomFieldsEndpoint
{
    private const int MaxTitleLength = 200;
    private const int MaxDescriptionLength = 2_000;
    private const int MaxFieldsPerType = 3;

    public static void MapInventoryCustomFieldsEndpoint(this RouteGroupBuilder apiGroup)
    {
        var fieldsGroup = apiGroup
            .MapGroup("/inventories/{inventoryId}/custom-fields")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status401Unauthorized),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status403Forbidden),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status404NotFound));

        fieldsGroup
            .MapPut(string.Empty, ReplaceAsync)
            .WithName("ReplaceInventoryCustomFields")
            .WithMetadata(new ProducesResponseTypeAttribute(typeof(ReplaceInventoryCustomFieldsResponse), StatusCodes.Status200OK))
            .RequireAuthenticatedAccess()
            .RequireIfMatch();
    }

    private static async Task<Results<Ok<ReplaceInventoryCustomFieldsResponse>, ValidationProblem, ProblemHttpResult>> ReplaceAsync(
        string inventoryId,
        ReplaceInventoryCustomFieldsRequest request,
        ICurrentUserAccessor currentUserAccessor,
        IReplaceInventoryCustomFieldsUseCase useCase,
        IETagService eTagService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var parsedInventoryId = ParseRequiredPositiveLong(inventoryId, "inventoryId", errors);
        var parsedFields = ParseFields(request.Fields, errors);

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
                new ReplaceInventoryCustomFieldsCommand(
                    parsedInventoryId.Value,
                    actorUserId,
                    HasAdminRole(currentUser.Roles),
                    httpContext.GetIfMatchToken(),
                    parsedFields),
                cancellationToken);

            httpContext.Response.Headers.ETag = eTagService.ToETag(result.Version);
            return TypedResults.Ok(ReplaceInventoryCustomFieldsResponse.FromResult(result));
        }
        catch (InventoryNotFoundException exception)
        {
            return CreateProblem(
                StatusCodes.Status404NotFound,
                "Not Found",
                $"Inventory '{exception.InventoryId.ToString(CultureInfo.InvariantCulture)}' was not found.",
                "inventory_not_found");
        }
        catch (InventoryEditorMutationAccessDeniedException)
        {
            return CreateProblem(
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "You do not have permission to modify this inventory.",
                "inventory_write_forbidden");
        }
        catch (InventoryCustomFieldNotFoundException exception)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["fields"] =
                [
                    $"Field with id '{exception.FieldId.ToString(CultureInfo.InvariantCulture)}' does not exist in this inventory."
                ]
            });
        }
        catch (InventoryCustomFieldTypeChangeNotAllowedException exception)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["fields"] =
                [
                    $"Field '{exception.FieldId.ToString(CultureInfo.InvariantCulture)}' cannot change type from '{ToApiFieldType(exception.CurrentType)}' to '{ToApiFieldType(exception.RequestedType)}'. Remove and create a new field instead."
                ]
            });
        }
        catch (InventoryCustomFieldSlotsExhaustedException exception)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["fields"] =
                [
                    $"No free slot is available for field type '{ToApiFieldType(exception.FieldType)}'. Maximum is {MaxFieldsPerType.ToString(CultureInfo.InvariantCulture)}."
                ]
            });
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

    private static IReadOnlyList<ReplaceInventoryCustomFieldInput> ParseFields(
        IReadOnlyList<ReplaceInventoryCustomFieldRequest>? rawFields,
        IDictionary<string, string[]> errors)
    {
        if (rawFields is null || rawFields.Count == 0)
        {
            return Array.Empty<ReplaceInventoryCustomFieldInput>();
        }

        var parsedFields = new List<ReplaceInventoryCustomFieldInput>(rawFields.Count);
        var usedIds = new HashSet<long>();
        var fieldsPerType = new Dictionary<CustomFieldType, int>();

        for (var i = 0; i < rawFields.Count; i++)
        {
            var path = $"fields[{i}]";
            var rawField = rawFields[i];
            if (rawField is null)
            {
                errors[path] = ["field is required."];
                continue;
            }

            long? parsedId = null;
            if (!string.IsNullOrWhiteSpace(rawField.Id))
            {
                if (long.TryParse(rawField.Id.Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out var idValue)
                    && idValue > 0)
                {
                    if (!usedIds.Add(idValue))
                    {
                        errors[$"{path}.id"] = ["Duplicate field id is not allowed."];
                    }
                    else
                    {
                        parsedId = idValue;
                    }
                }
                else
                {
                    errors[$"{path}.id"] = ["id must be a positive integer when provided."];
                }
            }

            if (!TryParseFieldType(rawField.FieldType, out var fieldType))
            {
                errors[$"{path}.fieldType"] = ["fieldType must be one of single_line, multi_line, number, link, bool."];
                continue;
            }

            fieldsPerType.TryGetValue(fieldType, out var count);
            count++;
            fieldsPerType[fieldType] = count;
            if (count > MaxFieldsPerType)
            {
                errors["fields"] =
                [
                    $"No more than {MaxFieldsPerType.ToString(CultureInfo.InvariantCulture)} fields per type are allowed."
                ];
            }

            var title = rawField.Title?.Trim();
            if (string.IsNullOrWhiteSpace(title))
            {
                errors[$"{path}.title"] = ["title is required."];
            }
            else if (title.Length > MaxTitleLength)
            {
                errors[$"{path}.title"] = [$"title must be {MaxTitleLength.ToString(CultureInfo.InvariantCulture)} characters or less."];
            }

            var description = rawField.Description?.Trim() ?? string.Empty;
            if (description.Length > MaxDescriptionLength)
            {
                errors[$"{path}.description"] =
                [
                    $"description must be {MaxDescriptionLength.ToString(CultureInfo.InvariantCulture)} characters or less."
                ];
            }

            if (errors.Keys.Any(key => key.StartsWith(path, StringComparison.Ordinal)))
            {
                continue;
            }

            parsedFields.Add(new ReplaceInventoryCustomFieldInput(
                parsedId,
                fieldType,
                title!,
                description,
                rawField.ShowInTable));
        }

        return parsedFields;
    }

    private static bool TryParseFieldType(string? rawFieldType, out CustomFieldType fieldType)
    {
        if (string.IsNullOrWhiteSpace(rawFieldType))
        {
            fieldType = default;
            return false;
        }

        return rawFieldType.Trim().ToLowerInvariant() switch
        {
            "single_line" => Set(out fieldType, CustomFieldType.SingleLine),
            "multi_line" => Set(out fieldType, CustomFieldType.MultiLine),
            "number" => Set(out fieldType, CustomFieldType.Number),
            "link" => Set(out fieldType, CustomFieldType.Link),
            "bool" => Set(out fieldType, CustomFieldType.Bool),
            _ => Set(out fieldType, default, false)
        };
    }

    private static bool Set(out CustomFieldType fieldType, CustomFieldType value, bool result = true)
    {
        fieldType = value;
        return result;
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

    internal static string ToApiFieldType(CustomFieldType fieldType)
    {
        return fieldType switch
        {
            CustomFieldType.SingleLine => "single_line",
            CustomFieldType.MultiLine => "multi_line",
            CustomFieldType.Number => "number",
            CustomFieldType.Link => "link",
            CustomFieldType.Bool => "bool",
            _ => throw new ArgumentOutOfRangeException(nameof(fieldType), fieldType, "Unsupported custom field type.")
        };
    }
}

public sealed record ReplaceInventoryCustomFieldsRequest(
    IReadOnlyList<ReplaceInventoryCustomFieldRequest>? Fields);

public sealed record ReplaceInventoryCustomFieldRequest(
    string? Id,
    string? FieldType,
    string? Title,
    string? Description,
    bool ShowInTable);

public sealed record ReplaceInventoryCustomFieldsResponse(
    int Version,
    IReadOnlyList<ReplaceInventoryCustomFieldResponse> Fields)
{
    public static ReplaceInventoryCustomFieldsResponse FromResult(InventoryVersionResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new ReplaceInventoryCustomFieldsResponse(
            result.Version,
            (result.ActiveCustomFields ?? Array.Empty<InventoryVersionCustomFieldResult>())
                .Select(field => new ReplaceInventoryCustomFieldResponse(
                    field.Id.ToString(CultureInfo.InvariantCulture),
                    InventoryCustomFieldsEndpoint.ToApiFieldType(field.FieldType),
                    field.Title,
                    field.Description,
                    field.ShowInTable))
                .ToArray());
    }
}

public sealed record ReplaceInventoryCustomFieldResponse(
    string Id,
    string FieldType,
    string Title,
    string Description,
    bool ShowInTable);
