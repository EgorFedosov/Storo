using System.Globalization;
using backend.Modules.Auth.Api;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Concurrency.Api;
using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Inventories.Domain;
using backend.Modules.Inventories.UseCases.CustomIdTemplate;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Inventories.Api;

public static class InventoryCustomIdTemplateEndpoint
{
    private const int MaxFixedTextLength = 500;
    private const int MaxFormatPatternLength = 200;

    public static void MapInventoryCustomIdTemplateEndpoint(this RouteGroupBuilder apiGroup)
    {
        var templateGroup = apiGroup
            .MapGroup("/inventories/{inventoryId}/custom-id-template")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status401Unauthorized),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status403Forbidden),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status404NotFound));

        templateGroup
            .MapPut(string.Empty, ReplaceAsync)
            .WithName("ReplaceInventoryCustomIdTemplate")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(CustomIdTemplateResponse), StatusCodes.Status200OK))
            .RequireAuthenticatedAccess()
            .RequireIfMatch();

        templateGroup
            .MapPost("preview", PreviewAsync)
            .WithName("PreviewInventoryCustomIdTemplate")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(CustomIdTemplateResponse), StatusCodes.Status200OK))
            .RequireAuthenticatedAccess();
    }

    private static async Task<Results<Ok<CustomIdTemplateResponse>, ValidationProblem, ProblemHttpResult>> ReplaceAsync(
        string inventoryId,
        CustomIdTemplateRequest request,
        ICurrentUserAccessor currentUserAccessor,
        IReplaceCustomIdTemplateUseCase useCase,
        IETagService eTagService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        var parsedInventoryId = ParseRequiredPositiveLong(inventoryId, "inventoryId", errors);
        var parts = ParseParts(request.Parts, errors);

        if (!parsedInventoryId.HasValue || errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var currentUser = currentUserAccessor.CurrentUser;
        var actorUserId = currentUser.UserId
                          ?? throw new InvalidOperationException(
                              "Authenticated user id claim is missing.");

        try
        {
            var result = await useCase.ExecuteAsync(
                new ReplaceCustomIdTemplateCommand(
                    parsedInventoryId.Value,
                    actorUserId,
                    HasAdminRole(currentUser.Roles),
                    httpContext.GetIfMatchToken(),
                    request.IsEnabled,
                    parts),
                cancellationToken);

            httpContext.Response.Headers.ETag = eTagService.ToETag(result.Version);
            return TypedResults.Ok(CustomIdTemplateResponse.FromResult(result));
        }
        catch (InventoryNotFoundException exception)
        {
            return CreateProblem(
                StatusCodes.Status404NotFound,
                "Not Found",
                $"Inventory '{exception.InventoryId.ToString(CultureInfo.InvariantCulture)}' was not found.",
                "inventory_not_found");
        }
        catch (InventoryCustomIdTemplateAccessDeniedException)
        {
            return CreateProblem(
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "You do not have permission to modify this inventory.",
                "inventory_write_forbidden");
        }
    }

    private static async Task<Results<Ok<CustomIdTemplateResponse>, ValidationProblem, ProblemHttpResult>> PreviewAsync(
        string inventoryId,
        CustomIdTemplateRequest request,
        ICurrentUserAccessor currentUserAccessor,
        IPreviewCustomIdTemplateUseCase useCase,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        var parsedInventoryId = ParseRequiredPositiveLong(inventoryId, "inventoryId", errors);
        var parts = ParseParts(request.Parts, errors);

        if (!parsedInventoryId.HasValue || errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var currentUser = currentUserAccessor.CurrentUser;
        var actorUserId = currentUser.UserId
                          ?? throw new InvalidOperationException(
                              "Authenticated user id claim is missing.");

        try
        {
            var result = await useCase.ExecuteAsync(
                new PreviewCustomIdTemplateQuery(
                    parsedInventoryId.Value,
                    actorUserId,
                    HasAdminRole(currentUser.Roles),
                    request.IsEnabled,
                    parts),
                cancellationToken);

            return TypedResults.Ok(CustomIdTemplateResponse.FromResult(result));
        }
        catch (InventoryNotFoundException exception)
        {
            return CreateProblem(
                StatusCodes.Status404NotFound,
                "Not Found",
                $"Inventory '{exception.InventoryId.ToString(CultureInfo.InvariantCulture)}' was not found.",
                "inventory_not_found");
        }
        catch (InventoryCustomIdTemplateAccessDeniedException)
        {
            return CreateProblem(
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "You do not have permission to modify this inventory.",
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

    private static IReadOnlyList<CustomIdTemplatePartInput> ParseParts(
        IReadOnlyList<CustomIdTemplatePartRequest>? rawParts,
        IDictionary<string, string[]> errors)
    {
        if (rawParts is null || rawParts.Count == 0)
        {
            return Array.Empty<CustomIdTemplatePartInput>();
        }

        var parsedParts = new List<CustomIdTemplatePartInput>(rawParts.Count);
        var sequencePartsCount = 0;

        for (var i = 0; i < rawParts.Count; i++)
        {
            var partPath = $"parts[{i}]";
            var rawPart = rawParts[i];
            if (rawPart is null)
            {
                errors[partPath] = ["part is required."];
                continue;
            }

            if (!TryParsePartType(rawPart.PartType, out var partType))
            {
                errors[$"{partPath}.partType"] =
                [
                    "partType must be one of fixed_text, random_20_bit, random_32_bit, random_6_digit, random_9_digit, guid, datetime, sequence."
                ];
                continue;
            }

            var fixedText = NormalizeFixedText(rawPart.FixedText);
            var formatPattern = NormalizeFormatPattern(rawPart.FormatPattern);

            if (partType == CustomIdPartType.FixedText)
            {
                if (string.IsNullOrWhiteSpace(fixedText))
                {
                    errors[$"{partPath}.fixedText"] = ["fixedText is required for fixed_text part."];
                }
                else if (fixedText.Length > MaxFixedTextLength)
                {
                    errors[$"{partPath}.fixedText"] = [$"fixedText must be {MaxFixedTextLength} characters or less."];
                }

                if (!string.IsNullOrWhiteSpace(rawPart.FormatPattern))
                {
                    errors[$"{partPath}.formatPattern"] = ["formatPattern is not allowed for fixed_text part."];
                }
            }
            else
            {
                fixedText = null;
                if (!string.IsNullOrWhiteSpace(rawPart.FixedText))
                {
                    errors[$"{partPath}.fixedText"] = ["fixedText is allowed only for fixed_text part."];
                }
            }

            if (partType is CustomIdPartType.DateTime or CustomIdPartType.Sequence)
            {
                if (formatPattern is { Length: > MaxFormatPatternLength })
                {
                    errors[$"{partPath}.formatPattern"] =
                    [
                        $"formatPattern must be {MaxFormatPatternLength} characters or less."
                    ];
                }
            }
            else
            {
                formatPattern = null;
                if (!string.IsNullOrWhiteSpace(rawPart.FormatPattern))
                {
                    errors[$"{partPath}.formatPattern"] = ["formatPattern is allowed only for datetime and sequence parts."];
                }
            }

            if (partType == CustomIdPartType.Sequence)
            {
                sequencePartsCount++;
            }

            parsedParts.Add(new CustomIdTemplatePartInput(partType, fixedText, formatPattern));
        }

        if (sequencePartsCount > 1)
        {
            errors["parts"] = ["Only one sequence part is allowed."];
        }

        return parsedParts;
    }

    private static string? NormalizeFixedText(string? value)
    {
        if (value is null)
        {
            return null;
        }

        return value.Trim();
    }

    private static string? NormalizeFormatPattern(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
    }

    private static bool TryParsePartType(string? rawPartType, out CustomIdPartType partType)
    {
        if (string.IsNullOrWhiteSpace(rawPartType))
        {
            partType = default;
            return false;
        }

        return rawPartType.Trim().ToLowerInvariant() switch
        {
            "fixed_text" => Set(out partType, CustomIdPartType.FixedText),
            "random_20_bit" => Set(out partType, CustomIdPartType.Random20Bit),
            "random_32_bit" => Set(out partType, CustomIdPartType.Random32Bit),
            "random_6_digit" => Set(out partType, CustomIdPartType.Random6Digit),
            "random_9_digit" => Set(out partType, CustomIdPartType.Random9Digit),
            "guid" => Set(out partType, CustomIdPartType.Guid),
            "datetime" => Set(out partType, CustomIdPartType.DateTime),
            "sequence" => Set(out partType, CustomIdPartType.Sequence),
            _ => Set(out partType, default, false)
        };
    }

    private static bool Set(out CustomIdPartType partType, CustomIdPartType value, bool result = true)
    {
        partType = value;
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

    internal static string ToApiPartType(CustomIdPartType partType)
    {
        return partType switch
        {
            CustomIdPartType.FixedText => "fixed_text",
            CustomIdPartType.Random20Bit => "random_20_bit",
            CustomIdPartType.Random32Bit => "random_32_bit",
            CustomIdPartType.Random6Digit => "random_6_digit",
            CustomIdPartType.Random9Digit => "random_9_digit",
            CustomIdPartType.Guid => "guid",
            CustomIdPartType.DateTime => "datetime",
            CustomIdPartType.Sequence => "sequence",
            _ => throw new ArgumentOutOfRangeException(nameof(partType), partType, "Unsupported custom id part type.")
        };
    }
}

public sealed record CustomIdTemplateRequest(
    bool IsEnabled,
    IReadOnlyList<CustomIdTemplatePartRequest>? Parts);

public sealed record CustomIdTemplatePartRequest(
    string? PartType,
    string? FixedText,
    string? FormatPattern);

public sealed record CustomIdTemplateResponse(
    bool IsEnabled,
    IReadOnlyList<CustomIdTemplatePartResponse> Parts,
    string? DerivedValidationRegex,
    CustomIdTemplatePreviewResponse Preview)
{
    public static CustomIdTemplateResponse FromResult(CustomIdTemplateResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new CustomIdTemplateResponse(
            result.IsEnabled,
            result.Parts
                .Select(part => new CustomIdTemplatePartResponse(
                    InventoryCustomIdTemplateEndpoint.ToApiPartType(part.PartType),
                    part.FixedText,
                    part.FormatPattern))
                .ToArray(),
            result.DerivedValidationRegex,
            new CustomIdTemplatePreviewResponse(
                result.Preview.SampleCustomId,
                result.Preview.Warnings.ToArray()));
    }
}

public sealed record CustomIdTemplatePartResponse(
    string PartType,
    string? FixedText,
    string? FormatPattern);

public sealed record CustomIdTemplatePreviewResponse(
    string SampleCustomId,
    IReadOnlyList<string> Warnings);
