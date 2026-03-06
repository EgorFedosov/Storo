using System.Globalization;
using backend.Modules.Auth.Api;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Items.UseCases.ItemLifecycle;
using backend.Modules.Items.UseCases.Likes;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Items.Api;

public static class ItemLikesEndpoint
{
    public static void MapItemLikesEndpoint(this RouteGroupBuilder apiGroup)
    {
        var likesGroup = apiGroup
            .MapGroup("/items/{itemId}/like")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status404NotFound));

        likesGroup
            .MapPut(string.Empty, SetAsync)
            .WithName("SetItemLike")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ItemLikeStateEndpointResponse), StatusCodes.Status200OK))
            .RequireAuthenticatedAccess();

        likesGroup
            .MapDelete(string.Empty, RemoveAsync)
            .WithName("RemoveItemLike")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ItemLikeStateEndpointResponse), StatusCodes.Status200OK))
            .RequireAuthenticatedAccess();
    }

    private static async Task<Results<Ok<ItemLikeStateEndpointResponse>, ValidationProblem, ProblemHttpResult>> SetAsync(
        string itemId,
        ICurrentUserAccessor currentUserAccessor,
        ISetItemLikeUseCase useCase,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var parsedItemId = ParseRequiredPositiveLong(itemId, "itemId", errors);
        if (!parsedItemId.HasValue)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var actorUserId = currentUserAccessor.CurrentUser.UserId
                          ?? throw new InvalidOperationException("Authenticated user id claim is missing.");

        try
        {
            var result = await useCase.ExecuteAsync(
                new SetItemLikeCommand(parsedItemId.Value, actorUserId),
                cancellationToken);

            return TypedResults.Ok(ItemLikeStateEndpointResponse.FromResult(result));
        }
        catch (ItemNotFoundException exception)
        {
            return CreateProblem(
                StatusCodes.Status404NotFound,
                "Not Found",
                $"Item '{exception.ItemId.ToString(CultureInfo.InvariantCulture)}' was not found.",
                "item_not_found");
        }
    }

    private static async Task<Results<Ok<ItemLikeStateEndpointResponse>, ValidationProblem, ProblemHttpResult>> RemoveAsync(
        string itemId,
        ICurrentUserAccessor currentUserAccessor,
        IRemoveItemLikeUseCase useCase,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var parsedItemId = ParseRequiredPositiveLong(itemId, "itemId", errors);
        if (!parsedItemId.HasValue)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var actorUserId = currentUserAccessor.CurrentUser.UserId
                          ?? throw new InvalidOperationException("Authenticated user id claim is missing.");

        try
        {
            var result = await useCase.ExecuteAsync(
                new RemoveItemLikeCommand(parsedItemId.Value, actorUserId),
                cancellationToken);

            return TypedResults.Ok(ItemLikeStateEndpointResponse.FromResult(result));
        }
        catch (ItemNotFoundException exception)
        {
            return CreateProblem(
                StatusCodes.Status404NotFound,
                "Not Found",
                $"Item '{exception.ItemId.ToString(CultureInfo.InvariantCulture)}' was not found.",
                "item_not_found");
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

public sealed record ItemLikeStateEndpointResponse(
    string ItemId,
    int Count,
    bool LikedByCurrentUser)
{
    public static ItemLikeStateEndpointResponse FromResult(ItemLikeStateResult result)
    {
        ArgumentNullException.ThrowIfNull(result);
        return new ItemLikeStateEndpointResponse(
            result.ItemId.ToString(CultureInfo.InvariantCulture),
            result.Count,
            result.LikedByCurrentUser);
    }
}
