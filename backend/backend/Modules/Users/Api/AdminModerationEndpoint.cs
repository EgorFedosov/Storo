using System.Globalization;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Users.UseCases.AdminModeration;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Users.Api;

public static class AdminModerationEndpoint
{
    public static void MapAdminModerationEndpoint(this RouteGroupBuilder apiGroup)
    {
        var moderationGroup = apiGroup.MapGroup("/admin/users")
            .RequireAuthorization(AuthorizationPolicies.Admin)
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status401Unauthorized),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status403Forbidden),
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status404NotFound));

        moderationGroup
            .MapPut("/{userId}/block", BlockAsync)
            .WithName("BlockUser");

        moderationGroup
            .MapDelete("/{userId}/block", UnblockAsync)
            .WithName("UnblockUser");

        moderationGroup
            .MapPut("/{userId}/roles/admin", GrantAdminAsync)
            .WithName("GrantAdminRole");

        moderationGroup
            .MapDelete("/{userId}/roles/admin", RevokeAdminAsync)
            .WithName("RevokeAdminRole");

        moderationGroup
            .MapDelete("/{userId}", DeleteAsync)
            .WithName("DeleteUser");
    }

    private static Task<Results<Ok<AdminModerationResponse>, ValidationProblem, NotFound<ProblemDetails>>> BlockAsync(
        string userId,
        IBlockUserUseCase useCase,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(
            userId,
            id => useCase.ExecuteAsync(new BlockUserCommand(id), cancellationToken));
    }

    private static Task<Results<Ok<AdminModerationResponse>, ValidationProblem, NotFound<ProblemDetails>>> UnblockAsync(
        string userId,
        IUnblockUserUseCase useCase,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(
            userId,
            id => useCase.ExecuteAsync(new UnblockUserCommand(id), cancellationToken));
    }

    private static Task<Results<Ok<AdminModerationResponse>, ValidationProblem, NotFound<ProblemDetails>>> GrantAdminAsync(
        string userId,
        IGrantAdminUseCase useCase,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(
            userId,
            id => useCase.ExecuteAsync(new GrantAdminCommand(id), cancellationToken));
    }

    private static Task<Results<Ok<AdminModerationResponse>, ValidationProblem, NotFound<ProblemDetails>>> RevokeAdminAsync(
        string userId,
        IRevokeAdminUseCase useCase,
        CancellationToken cancellationToken)
    {
        return ExecuteAsync(
            userId,
            id => useCase.ExecuteAsync(new RevokeAdminCommand(id), cancellationToken));
    }

    private static async Task<Results<NoContent, ValidationProblem, NotFound<ProblemDetails>>> DeleteAsync(
        string userId,
        IDeleteUserUseCase useCase,
        CancellationToken cancellationToken)
    {
        if (!TryParseUserId(userId, out var parsedUserId, out var validationProblem))
        {
            return validationProblem;
        }

        try
        {
            await useCase.ExecuteAsync(new DeleteUserCommand(parsedUserId), cancellationToken);
            return TypedResults.NoContent();
        }
        catch (AdminUserNotFoundException exception)
        {
            return CreateNotFoundResult(exception.UserId);
        }
    }

    private static async Task<Results<Ok<AdminModerationResponse>, ValidationProblem, NotFound<ProblemDetails>>> ExecuteAsync(
        string userId,
        Func<long, Task<AdminModerationResult>> execute)
    {
        if (!TryParseUserId(userId, out var parsedUserId, out var validationProblem))
        {
            return validationProblem;
        }

        try
        {
            var result = await execute(parsedUserId);
            return TypedResults.Ok(AdminModerationResponse.FromResult(result));
        }
        catch (AdminUserNotFoundException exception)
        {
            return CreateNotFoundResult(exception.UserId);
        }
    }

    private static bool TryParseUserId(string rawUserId, out long userId, out ValidationProblem validationProblem)
    {
        if (long.TryParse(rawUserId, NumberStyles.None, CultureInfo.InvariantCulture, out userId)
            && userId > 0)
        {
            validationProblem = null!;
            return true;
        }

        validationProblem = TypedResults.ValidationProblem(new Dictionary<string, string[]>
        {
            ["userId"] = ["userId must be a positive integer."]
        });

        return false;
    }

    private static NotFound<ProblemDetails> CreateNotFoundResult(long userId)
    {
        var problemDetails = new ProblemDetails
        {
            Status = StatusCodes.Status404NotFound,
            Title = "Not Found",
            Detail = $"User '{userId}' was not found.",
            Type = "https://httpstatuses.com/404"
        };

        problemDetails.Extensions["code"] = "user_not_found";
        return TypedResults.NotFound(problemDetails);
    }
}
