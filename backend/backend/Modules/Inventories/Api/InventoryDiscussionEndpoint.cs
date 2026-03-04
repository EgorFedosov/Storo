using System.Globalization;
using backend.Modules.Auth.Api;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Inventories.UseCases.Discussion;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Inventories.Api;

public static class InventoryDiscussionEndpoint
{
    private const int DefaultLimit = 50;
    private const int MaxLimit = 200;
    private const int MaxContentLength = 10_000;

    public static void MapInventoryDiscussionEndpoint(this RouteGroupBuilder apiGroup)
    {
        var discussionGroup = apiGroup
            .MapGroup("/inventories/{inventoryId}/discussion/posts")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status404NotFound));

        discussionGroup
            .MapGet(string.Empty, ListAsync)
            .WithName("ListDiscussionPosts")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(DiscussionPostsResponse), StatusCodes.Status200OK));

        discussionGroup
            .MapPost(string.Empty, CreateAsync)
            .WithName("CreateDiscussionPost")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(DiscussionPostResponse), StatusCodes.Status201Created))
            .RequireAuthenticatedAccess();
    }

    private static async Task<Results<Ok<DiscussionPostsResponse>, ValidationProblem, NotFound<ProblemDetails>>> ListAsync(
        string inventoryId,
        [AsParameters] ListDiscussionPostsRequest request,
        IListDiscussionPostsUseCase useCase,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        var parsedInventoryId = ParseRequiredPositiveLong(inventoryId, "inventoryId", errors);
        var afterId = ParseOptionalPositiveLong(request.AfterId, "afterId", errors);
        var beforeId = ParseOptionalPositiveLong(request.BeforeId, "beforeId", errors);
        var limit = ParseLimit(request.Limit, errors);

        if (afterId.HasValue && beforeId.HasValue)
        {
            errors["cursor"] = ["Specify only one of afterId or beforeId."];
        }

        if (!parsedInventoryId.HasValue || !limit.HasValue || errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        try
        {
            var result = await useCase.ExecuteAsync(
                new ListDiscussionPostsQuery(parsedInventoryId.Value, afterId, beforeId, limit.Value),
                cancellationToken);

            return TypedResults.Ok(DiscussionPostsResponse.FromResult(result));
        }
        catch (InventoryNotFoundException exception)
        {
            return CreateInventoryNotFoundResult(exception.InventoryId);
        }
    }

    private static async Task<Results<Created<DiscussionPostResponse>, ValidationProblem, NotFound<ProblemDetails>>> CreateAsync(
        string inventoryId,
        CreateDiscussionPostRequest request,
        ICurrentUserAccessor currentUserAccessor,
        ICreateDiscussionPostUseCase useCase,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        var parsedInventoryId = ParseRequiredPositiveLong(inventoryId, "inventoryId", errors);
        var contentMarkdown = ParseContentMarkdown(request.ContentMarkdown, errors);

        if (!parsedInventoryId.HasValue || contentMarkdown is null || errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var currentUserId = currentUserAccessor.CurrentUser.UserId
                            ?? throw new InvalidOperationException(
                                "Authenticated user id claim is missing.");

        try
        {
            var result = await useCase.ExecuteAsync(
                new CreateDiscussionPostCommand(parsedInventoryId.Value, currentUserId, contentMarkdown),
                cancellationToken);

            var response = DiscussionPostResponse.FromResult(result);
            var location = $"/api/v1/inventories/{parsedInventoryId.Value.ToString(CultureInfo.InvariantCulture)}/discussion/posts";
            return TypedResults.Created(location, response);
        }
        catch (InventoryNotFoundException exception)
        {
            return CreateInventoryNotFoundResult(exception.InventoryId);
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

    private static long? ParseOptionalPositiveLong(
        string? rawValue,
        string fieldName,
        IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return null;
        }

        if (long.TryParse(rawValue, NumberStyles.None, CultureInfo.InvariantCulture, out var parsedValue)
            && parsedValue > 0)
        {
            return parsedValue;
        }

        errors[fieldName] = [$"{fieldName} must be a positive integer."];
        return null;
    }

    private static int? ParseLimit(int? rawValue, IDictionary<string, string[]> errors)
    {
        var limit = rawValue ?? DefaultLimit;
        if (limit is >= 1 and <= MaxLimit)
        {
            return limit;
        }

        errors["limit"] = [$"limit must be between 1 and {MaxLimit}."];
        return null;
    }

    private static string? ParseContentMarkdown(string? rawContentMarkdown, IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(rawContentMarkdown))
        {
            errors["contentMarkdown"] = ["contentMarkdown is required."];
            return null;
        }

        var contentMarkdown = rawContentMarkdown.Trim();
        if (contentMarkdown.Length > MaxContentLength)
        {
            errors["contentMarkdown"] = [$"contentMarkdown must be {MaxContentLength} characters or less."];
            return null;
        }

        return contentMarkdown;
    }

    private static NotFound<ProblemDetails> CreateInventoryNotFoundResult(long inventoryId)
    {
        var problemDetails = new ProblemDetails
        {
            Status = StatusCodes.Status404NotFound,
            Title = "Not Found",
            Detail = $"Inventory '{inventoryId.ToString(CultureInfo.InvariantCulture)}' was not found.",
            Type = "https://httpstatuses.com/404"
        };

        problemDetails.Extensions["code"] = "inventory_not_found";
        return TypedResults.NotFound(problemDetails);
    }
}

public sealed record ListDiscussionPostsRequest(
    [property: FromQuery(Name = "afterId")] string? AfterId,
    [property: FromQuery(Name = "beforeId")] string? BeforeId,
    [property: FromQuery(Name = "limit")] int? Limit);

public sealed record CreateDiscussionPostRequest(string? ContentMarkdown);
