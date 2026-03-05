using System.Globalization;
using backend.Modules.Auth.Api;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Concurrency.Api;
using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Inventories.UseCases.EditorMutations;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Inventories.Api;

public static class InventoryEditorMutationsEndpoint
{
    private const int MaxTitleLength = 200;
    private const int MaxDescriptionLength = 10_000;
    private const int MaxImageUrlLength = 2_048;
    private const int MaxTagLength = 100;
    private const string PublicAccessMode = "public";
    private const string RestrictedAccessMode = "restricted";

    public static void MapInventoryEditorMutationsEndpoint(this RouteGroupBuilder apiGroup)
    {
        var mutationsGroup = apiGroup
            .MapGroup("/inventories/{inventoryId}")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status401Unauthorized),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status403Forbidden),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status404NotFound));

        mutationsGroup
            .MapPut("settings", UpdateSettingsAsync)
            .WithName("UpdateInventorySettings")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(InventoryVersionResponse), StatusCodes.Status200OK))
            .RequireAuthenticatedAccess()
            .RequireIfMatch();

        mutationsGroup
            .MapPut("tags", ReplaceTagsAsync)
            .WithName("ReplaceInventoryTags")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(InventoryVersionResponse), StatusCodes.Status200OK))
            .RequireAuthenticatedAccess()
            .RequireIfMatch();

        mutationsGroup
            .MapPut("access", ReplaceAccessAsync)
            .WithName("ReplaceInventoryAccess")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(InventoryVersionResponse), StatusCodes.Status200OK))
            .RequireAuthenticatedAccess()
            .RequireIfMatch();
    }

    private static async Task<Results<Ok<InventoryVersionResponse>, ValidationProblem, ProblemHttpResult>> UpdateSettingsAsync(
        string inventoryId,
        UpdateInventorySettingsRequest request,
        ICurrentUserAccessor currentUserAccessor,
        IUpdateInventorySettingsUseCase useCase,
        IETagService eTagService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        var parsedInventoryId = ParseRequiredPositiveLong(inventoryId, "inventoryId", errors);
        var title = ParseRequiredTrimmedString(request.Title, "title", MaxTitleLength, errors);
        var categoryId = ParseRequiredPositiveInt(request.CategoryId, "categoryId", errors);
        var descriptionMarkdown = ParseDescriptionMarkdown(request.DescriptionMarkdown, errors);
        var imageUrl = ParseOptionalImageUrl(request.ImageUrl, "imageUrl", errors);

        if (!parsedInventoryId.HasValue || !categoryId.HasValue || title is null || descriptionMarkdown is null || errors.Count > 0)
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
                new UpdateInventorySettingsCommand(
                    parsedInventoryId.Value,
                    actorUserId,
                    HasAdminRole(currentUser.Roles),
                    httpContext.GetIfMatchToken(),
                    title,
                    descriptionMarkdown,
                    categoryId.Value,
                    imageUrl),
                cancellationToken);

            httpContext.Response.Headers.ETag = eTagService.ToETag(result.Version);
            return TypedResults.Ok(new InventoryVersionResponse(result.Version));
        }
        catch (InventoryCategoryNotFoundException)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["categoryId"] = ["categoryId does not exist."]
            });
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
    }

    private static async Task<Results<Ok<InventoryVersionResponse>, ValidationProblem, ProblemHttpResult>> ReplaceTagsAsync(
        string inventoryId,
        ReplaceInventoryTagsRequest request,
        ICurrentUserAccessor currentUserAccessor,
        IReplaceInventoryTagsUseCase useCase,
        IETagService eTagService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        var parsedInventoryId = ParseRequiredPositiveLong(inventoryId, "inventoryId", errors);
        var tags = NormalizeTags(request.Tags, errors);

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
                new ReplaceInventoryTagsCommand(
                    parsedInventoryId.Value,
                    actorUserId,
                    HasAdminRole(currentUser.Roles),
                    httpContext.GetIfMatchToken(),
                    tags),
                cancellationToken);

            httpContext.Response.Headers.ETag = eTagService.ToETag(result.Version);
            return TypedResults.Ok(new InventoryVersionResponse(result.Version));
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
    }

    private static async Task<Results<Ok<InventoryVersionResponse>, ValidationProblem, ProblemHttpResult>> ReplaceAccessAsync(
        string inventoryId,
        ReplaceInventoryAccessRequest request,
        ICurrentUserAccessor currentUserAccessor,
        IReplaceInventoryAccessUseCase useCase,
        IETagService eTagService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        var parsedInventoryId = ParseRequiredPositiveLong(inventoryId, "inventoryId", errors);
        var mode = ParseAccessMode(request.Mode, errors);
        var writerUserIds = ParseWriterUserIds(request.WriterUserIds, errors);

        if (!parsedInventoryId.HasValue || !mode.HasValue || errors.Count > 0)
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
                new ReplaceInventoryAccessCommand(
                    parsedInventoryId.Value,
                    actorUserId,
                    HasAdminRole(currentUser.Roles),
                    httpContext.GetIfMatchToken(),
                    mode.Value,
                    writerUserIds),
                cancellationToken);

            httpContext.Response.Headers.ETag = eTagService.ToETag(result.Version);
            return TypedResults.Ok(new InventoryVersionResponse(result.Version));
        }
        catch (InventoryAccessUsersNotFoundException exception)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["writerUserIds"] =
                [
                    $"The following users were not found: {string.Join(", ", exception.MissingUserIds.Select(id => id.ToString(CultureInfo.InvariantCulture)))}."
                ]
            });
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

    private static int? ParseRequiredPositiveInt(
        int? rawValue,
        string fieldName,
        IDictionary<string, string[]> errors)
    {
        if (rawValue is > 0)
        {
            return rawValue.Value;
        }

        errors[fieldName] = [$"{fieldName} must be a positive integer."];
        return null;
    }

    private static string? ParseRequiredTrimmedString(
        string? rawValue,
        string fieldName,
        int maxLength,
        IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            errors[fieldName] = [$"{fieldName} is required."];
            return null;
        }

        var trimmed = rawValue.Trim();
        if (trimmed.Length > maxLength)
        {
            errors[fieldName] = [$"{fieldName} must be {maxLength} characters or less."];
            return null;
        }

        return trimmed;
    }

    private static string? ParseDescriptionMarkdown(
        string? rawValue,
        IDictionary<string, string[]> errors)
    {
        var value = rawValue ?? string.Empty;
        if (value.Length > MaxDescriptionLength)
        {
            errors["descriptionMarkdown"] =
            [
                $"descriptionMarkdown must be {MaxDescriptionLength} characters or less."
            ];
            return null;
        }

        return value;
    }

    private static string? ParseOptionalImageUrl(
        string? rawValue,
        string fieldName,
        IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return null;
        }

        var value = rawValue.Trim();
        if (value.Length > MaxImageUrlLength)
        {
            errors[fieldName] = [$"{fieldName} must be {MaxImageUrlLength} characters or less."];
            return null;
        }

        if (!Uri.TryCreate(value, UriKind.Absolute, out _))
        {
            errors[fieldName] = [$"{fieldName} must be a valid absolute URL."];
            return null;
        }

        return value;
    }

    private static IReadOnlyCollection<string> NormalizeTags(
        IReadOnlyList<string>? rawTags,
        IDictionary<string, string[]> errors)
    {
        if (rawTags is null || rawTags.Count == 0)
        {
            return Array.Empty<string>();
        }

        var tags = new List<string>(rawTags.Count);

        for (var i = 0; i < rawTags.Count; i++)
        {
            if (string.IsNullOrWhiteSpace(rawTags[i]))
            {
                errors[$"tags[{i}]"] = ["tag must not be empty."];
                continue;
            }

            var trimmedTag = rawTags[i].Trim();
            if (trimmedTag.Length > MaxTagLength)
            {
                errors[$"tags[{i}]"] = [$"tag must be {MaxTagLength} characters or less."];
                continue;
            }

            if (!tags.Contains(trimmedTag, StringComparer.OrdinalIgnoreCase))
            {
                tags.Add(trimmedTag);
            }
        }

        return tags;
    }

    private static InventoryAccessMode? ParseAccessMode(
        string? rawMode,
        IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(rawMode))
        {
            errors["mode"] = ["mode is required and must be either public or restricted."];
            return null;
        }

        return rawMode.Trim().ToLowerInvariant() switch
        {
            PublicAccessMode => InventoryAccessMode.Public,
            RestrictedAccessMode => InventoryAccessMode.Restricted,
            _ => AddModeError(errors)
        };
    }

    private static InventoryAccessMode? AddModeError(IDictionary<string, string[]> errors)
    {
        errors["mode"] = ["mode must be either public or restricted."];
        return null;
    }

    private static IReadOnlyCollection<long> ParseWriterUserIds(
        IReadOnlyList<string>? rawWriterUserIds,
        IDictionary<string, string[]> errors)
    {
        if (rawWriterUserIds is null || rawWriterUserIds.Count == 0)
        {
            return Array.Empty<long>();
        }

        var writerUserIds = new List<long>(rawWriterUserIds.Count);
        var seen = new HashSet<long>();

        for (var i = 0; i < rawWriterUserIds.Count; i++)
        {
            var rawWriterUserId = rawWriterUserIds[i];
            if (long.TryParse(rawWriterUserId, NumberStyles.None, CultureInfo.InvariantCulture, out var writerUserId)
                && writerUserId > 0)
            {
                if (seen.Add(writerUserId))
                {
                    writerUserIds.Add(writerUserId);
                }

                continue;
            }

            errors[$"writerUserIds[{i}]"] = ["writerUserId must be a positive integer string."];
        }

        return writerUserIds;
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
}

public sealed record UpdateInventorySettingsRequest(
    string? Title,
    string? DescriptionMarkdown,
    int? CategoryId,
    string? ImageUrl);

public sealed record ReplaceInventoryTagsRequest(IReadOnlyList<string>? Tags);

public sealed record ReplaceInventoryAccessRequest(
    string? Mode,
    IReadOnlyList<string>? WriterUserIds);

public sealed record InventoryVersionResponse(int Version);
