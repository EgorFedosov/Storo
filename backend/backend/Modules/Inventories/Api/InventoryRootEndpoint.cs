using System.Globalization;
using backend.Modules.Auth.Api;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Inventories.UseCases.CreateInventory;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Inventories.Api;

public static class InventoryRootEndpoint
{
    private const int MaxTitleLength = 200;
    private const int MaxDescriptionLength = 10_000;
    private const int MaxImageUrlLength = 2_048;
    private const int MaxTagLength = 100;

    public static void MapInventoryRootEndpoint(this RouteGroupBuilder apiGroup)
    {
        var inventoriesGroup = apiGroup
            .MapGroup("/inventories")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest));

        inventoriesGroup
            .MapPost(string.Empty, CreateAsync)
            .WithName("CreateInventory")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(InventoryDetailsResponse), StatusCodes.Status201Created))
            .RequireAuthenticatedAccess();

        inventoriesGroup
            .MapGet("/{inventoryId}", GetDetailsAsync)
            .WithName("GetInventoryDetails")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(InventoryDetailsResponse), StatusCodes.Status200OK),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status404NotFound));
    }

    private static async Task<Results<Created<InventoryDetailsResponse>, ValidationProblem>> CreateAsync(
        CreateInventoryRequest request,
        ICurrentUserAccessor currentUserAccessor,
        ICreateInventoryUseCase useCase,
        IETagService eTagService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var currentUserId = currentUserAccessor.CurrentUser.UserId
            ?? throw new InvalidOperationException("Authenticated user id claim is missing.");

        if (!TryCreateCommand(request, currentUserId, out var command, out var validationProblem))
        {
            return validationProblem;
        }

        try
        {
            var result = await useCase.ExecuteAsync(command, cancellationToken);
            var response = InventoryDetailsResponse.FromResult(result);

            httpContext.Response.Headers.ETag = eTagService.ToETag(result.Version);
            var location = $"/api/v1/inventories/{response.Id}";
            return TypedResults.Created(location, response);
        }
        catch (InventoryCategoryNotFoundException)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["categoryId"] = ["categoryId does not exist."]
            });
        }
    }

    private static async Task<Results<Ok<InventoryDetailsResponse>, ValidationProblem, NotFound<ProblemDetails>>> GetDetailsAsync(
        string inventoryId,
        ICurrentUserAccessor currentUserAccessor,
        IGetInventoryDetailsUseCase useCase,
        IETagService eTagService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        if (!TryParseInventoryId(inventoryId, out var parsedInventoryId, out var validationProblem))
        {
            return validationProblem;
        }

        var currentUser = currentUserAccessor.CurrentUser;
        var query = new GetInventoryDetailsQuery(
            parsedInventoryId,
            new InventoryViewerContext(
                currentUser.UserId,
                currentUser.IsAuthenticated,
                currentUser.IsBlocked,
                HasAdminRole(currentUser.Roles)));

        try
        {
            var result = await useCase.ExecuteAsync(query, cancellationToken);
            var response = InventoryDetailsResponse.FromResult(result);

            httpContext.Response.Headers.ETag = eTagService.ToETag(result.Version);
            return TypedResults.Ok(response);
        }
        catch (InventoryNotFoundException exception)
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

    private static bool TryCreateCommand(
        CreateInventoryRequest request,
        long currentUserId,
        out CreateInventoryCommand command,
        out ValidationProblem validationProblem)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        var title = request.Title?.Trim();
        if (string.IsNullOrWhiteSpace(title))
        {
            errors["title"] = ["title is required."];
        }
        else if (title.Length > MaxTitleLength)
        {
            errors["title"] = [$"title must be {MaxTitleLength} characters or less."];
        }

        if (request.CategoryId is null || request.CategoryId.Value <= 0)
        {
            errors["categoryId"] = ["categoryId must be a positive integer."];
        }

        var description = request.DescriptionMarkdown ?? string.Empty;
        if (description.Length > MaxDescriptionLength)
        {
            errors["descriptionMarkdown"] = [$"descriptionMarkdown must be {MaxDescriptionLength} characters or less."];
        }

        var imageUrl = request.ImageUrl?.Trim();
        if (string.IsNullOrWhiteSpace(imageUrl))
        {
            imageUrl = null;
        }
        else
        {
            if (imageUrl.Length > MaxImageUrlLength)
            {
                errors["imageUrl"] = [$"imageUrl must be {MaxImageUrlLength} characters or less."];
            }

            if (!Uri.TryCreate(imageUrl, UriKind.Absolute, out _))
            {
                errors["imageUrl"] = ["imageUrl must be a valid absolute URL."];
            }
        }

        var normalizedTags = NormalizeTags(request.Tags, errors);

        if (errors.Count > 0)
        {
            command = null!;
            validationProblem = TypedResults.ValidationProblem(errors);
            return false;
        }

        command = new CreateInventoryCommand(
            currentUserId,
            title!,
            request.CategoryId!.Value,
            description,
            imageUrl,
            request.IsPublic,
            normalizedTags);

        validationProblem = null!;
        return true;
    }

    private static IReadOnlyCollection<string> NormalizeTags(
        IReadOnlyList<string>? tags,
        IDictionary<string, string[]> errors)
    {
        if (tags is null || tags.Count == 0)
        {
            return Array.Empty<string>();
        }

        var normalizedTags = new List<string>(tags.Count);

        for (var i = 0; i < tags.Count; i++)
        {
            var rawTag = tags[i];
            if (string.IsNullOrWhiteSpace(rawTag))
            {
                errors[$"tags[{i}]"] = ["tag must not be empty."];
                continue;
            }

            var trimmedTag = rawTag.Trim();
            if (trimmedTag.Length > MaxTagLength)
            {
                errors[$"tags[{i}]"] = [$"tag must be {MaxTagLength} characters or less."];
                continue;
            }

            if (!normalizedTags.Contains(trimmedTag, StringComparer.OrdinalIgnoreCase))
            {
                normalizedTags.Add(trimmedTag);
            }
        }

        return normalizedTags;
    }

    private static bool TryParseInventoryId(
        string rawInventoryId,
        out long inventoryId,
        out ValidationProblem validationProblem)
    {
        if (long.TryParse(rawInventoryId, NumberStyles.None, CultureInfo.InvariantCulture, out inventoryId)
            && inventoryId > 0)
        {
            validationProblem = null!;
            return true;
        }

        validationProblem = TypedResults.ValidationProblem(new Dictionary<string, string[]>
        {
            ["inventoryId"] = ["inventoryId must be a positive integer."]
        });

        return false;
    }

    private static bool HasAdminRole(IReadOnlyCollection<string> roles)
    {
        return roles.Any(role => string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase));
    }
}

public sealed record CreateInventoryRequest(
    string? Title,
    int? CategoryId,
    string? DescriptionMarkdown,
    string? ImageUrl,
    bool IsPublic,
    IReadOnlyList<string>? Tags);
