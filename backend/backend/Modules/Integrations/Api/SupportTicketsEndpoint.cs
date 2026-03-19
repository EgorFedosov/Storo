using System.Globalization;
using System.Security.Claims;
using backend.Modules.Auth.Api;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Integrations.UseCases.SupportTickets;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Integrations.Api;

public static class SupportTicketsEndpoint
{
    private const string DropboxProvider = "dropbox";

    private const int MaxTicketIdLength = 128;
    private const int MaxSummaryLength = 4000;
    private const int MaxPageLinkLength = 2048;

    public static void MapSupportTicketsEndpoint(this RouteGroupBuilder apiGroup)
    {
        var supportTicketsGroup = apiGroup
            .MapGroup("/integrations/support-tickets")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status401Unauthorized),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status403Forbidden));

        supportTicketsGroup
            .MapPost(string.Empty, CreateAsync)
            .WithName("CreateSupportTicket")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(CreateSupportTicketResponse), StatusCodes.Status201Created),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status502BadGateway))
            .RequireAuthenticatedAccess();

        supportTicketsGroup
            .MapGet("/{ticketId}", GetStatusAsync)
            .WithName("GetSupportTicketStatus")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(GetSupportTicketStatusResponse), StatusCodes.Status200OK),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status404NotFound))
            .RequireAuthenticatedAccess();
    }

    private static async Task<Results<Created<CreateSupportTicketResponse>, ValidationProblem, ProblemHttpResult>> CreateAsync(
        CreateSupportTicketRequest request,
        ICurrentUserAccessor currentUserAccessor,
        ICreateSupportTicketUseCase useCase,
        CancellationToken cancellationToken)
    {
        var currentUser = currentUserAccessor.CurrentUser;
        var actorUserId = currentUser.UserId
                          ?? throw new InvalidOperationException("Authenticated user id claim is missing.");
        var actorEmail = currentUser.Principal.FindFirst(ClaimTypes.Email)?.Value?.Trim();
        if (string.IsNullOrWhiteSpace(actorEmail))
        {
            throw new InvalidOperationException("Authenticated user email claim is missing.");
        }

        var actorDisplayName = currentUser.Principal.FindFirst(ClaimTypes.Name)?.Value?.Trim();
        if (string.IsNullOrWhiteSpace(actorDisplayName))
        {
            actorDisplayName = actorEmail;
        }

        var actorIsAdmin = HasAdminRole(currentUser.Roles);

        if (!TryCreateCommand(
                request,
                actorUserId,
                actorEmail,
                actorDisplayName,
                actorIsAdmin,
                out var command,
                out var validationProblem))
        {
            return validationProblem;
        }

        try
        {
            var result = await useCase.ExecuteAsync(command, cancellationToken);
            var response = CreateSupportTicketResponse.FromResult(result);
            return TypedResults.Created("/api/v1/integrations/support-tickets", response);
        }
        catch (SupportTicketInventoryAccessDeniedException)
        {
            return CreateProblem(
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "You do not have access to the provided inventory context.",
                "support_ticket_inventory_forbidden");
        }
        catch (SupportTicketDropboxUpstreamException)
        {
            return CreateProblem(
                StatusCodes.Status502BadGateway,
                "Bad Gateway",
                "Dropbox API request failed while exporting support ticket.",
                "dropbox_upstream_error");
        }
    }

    private static async Task<Results<Ok<GetSupportTicketStatusResponse>, ValidationProblem, ProblemHttpResult>> GetStatusAsync(
        string ticketId,
        ICurrentUserAccessor currentUserAccessor,
        IGetSupportTicketStatusUseCase useCase,
        CancellationToken cancellationToken)
    {
        var currentUser = currentUserAccessor.CurrentUser;
        var actorUserId = currentUser.UserId
                          ?? throw new InvalidOperationException("Authenticated user id claim is missing.");
        var actorIsAdmin = HasAdminRole(currentUser.Roles);

        var normalizedTicketId = ticketId.Trim();
        if (string.IsNullOrWhiteSpace(normalizedTicketId) || normalizedTicketId.Length > MaxTicketIdLength)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["ticketId"] = ["ticketId is required and must be 128 characters or less."]
            });
        }

        try
        {
            var result = await useCase.ExecuteAsync(
                new GetSupportTicketStatusQuery(normalizedTicketId, actorUserId, actorIsAdmin),
                cancellationToken);

            return TypedResults.Ok(GetSupportTicketStatusResponse.FromResult(result));
        }
        catch (SupportTicketStatusAccessDeniedException)
        {
            return CreateProblem(
                StatusCodes.Status403Forbidden,
                "Forbidden",
                "You do not have access to this support ticket.",
                "support_ticket_forbidden");
        }
        catch (SupportTicketStatusNotFoundException)
        {
            return CreateProblem(
                StatusCodes.Status404NotFound,
                "Not Found",
                "Support ticket was not found.",
                "support_ticket_not_found");
        }
    }

    private static bool TryCreateCommand(
        CreateSupportTicketRequest request,
        long actorUserId,
        string actorEmail,
        string actorDisplayName,
        bool actorIsAdmin,
        out CreateSupportTicketCommand command,
        out ValidationProblem validationProblem)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        var summary = request.Summary?.Trim();
        if (string.IsNullOrWhiteSpace(summary))
        {
            errors["summary"] = ["summary is required."];
        }
        else if (summary.Length > MaxSummaryLength)
        {
            errors["summary"] = [$"summary must be {MaxSummaryLength.ToString(CultureInfo.InvariantCulture)} characters or less."];
        }

        var priority = NormalizePriority(request.Priority);
        if (priority is null)
        {
            errors["priority"] = ["priority must be one of: Low, Medium, High, Critical, Average."];
        }

        var pageLink = request.PageLink?.Trim();
        if (string.IsNullOrWhiteSpace(pageLink))
        {
            errors["pageLink"] = ["pageLink is required."];
        }
        else
        {
            if (pageLink.Length > MaxPageLinkLength)
            {
                errors["pageLink"] = [$"pageLink must be {MaxPageLinkLength.ToString(CultureInfo.InvariantCulture)} characters or less."];
            }

            if (!Uri.TryCreate(pageLink, UriKind.Absolute, out _))
            {
                errors["pageLink"] = ["pageLink must be a valid absolute URL."];
            }
        }

        var provider = request.Provider?.Trim().ToLowerInvariant();
        if (!string.Equals(provider, DropboxProvider, StringComparison.Ordinal))
        {
            errors["provider"] = ["provider must be 'dropbox' for this integration endpoint."];
        }

        long? inventoryId = null;
        var rawInventoryId = request.InventoryId?.Trim();
        if (!string.IsNullOrWhiteSpace(rawInventoryId))
        {
            if (!long.TryParse(rawInventoryId, NumberStyles.None, CultureInfo.InvariantCulture, out var parsedInventoryId)
                || parsedInventoryId <= 0)
            {
                errors["inventoryId"] = ["inventoryId must be a positive integer or null."];
            }
            else
            {
                inventoryId = parsedInventoryId;
            }
        }

        if (errors.Count > 0)
        {
            command = null!;
            validationProblem = TypedResults.ValidationProblem(errors);
            return false;
        }

        command = new CreateSupportTicketCommand(
            summary!,
            priority!,
            pageLink!,
            inventoryId,
            provider!,
            actorUserId,
            actorEmail,
            actorDisplayName,
            actorIsAdmin);

        validationProblem = null!;
        return true;
    }

    private static string? NormalizePriority(string? rawPriority)
    {
        if (string.IsNullOrWhiteSpace(rawPriority))
        {
            return null;
        }

        var normalized = rawPriority.Trim();
        if (string.Equals(normalized, "average", StringComparison.OrdinalIgnoreCase))
        {
            return "Medium";
        }

        if (string.Equals(normalized, "low", StringComparison.OrdinalIgnoreCase))
        {
            return "Low";
        }

        if (string.Equals(normalized, "medium", StringComparison.OrdinalIgnoreCase))
        {
            return "Medium";
        }

        if (string.Equals(normalized, "high", StringComparison.OrdinalIgnoreCase))
        {
            return "High";
        }

        if (string.Equals(normalized, "critical", StringComparison.OrdinalIgnoreCase))
        {
            return "Critical";
        }

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

    private static bool HasAdminRole(IReadOnlyCollection<string> roles)
    {
        return roles.Any(role => string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase));
    }
}

public sealed record CreateSupportTicketRequest(
    string? Summary,
    string? Priority,
    string? PageLink,
    string? InventoryId,
    string? Provider);

public sealed record CreateSupportTicketResponse(
    string TicketId,
    string Provider,
    string Status,
    string UploadedFileRef,
    DateTime CreatedAtUtc)
{
    public static CreateSupportTicketResponse FromResult(CreateSupportTicketResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new CreateSupportTicketResponse(
            result.TicketId,
            result.Provider,
            result.Status,
            result.UploadedFileRef,
            result.CreatedAtUtc);
    }
}

public sealed record GetSupportTicketStatusResponse(
    string TicketId,
    string Provider,
    string Status,
    string? UploadedFileRef,
    string? ErrorMessage,
    DateTime CreatedAtUtc,
    DateTime? UploadedAtUtc)
{
    public static GetSupportTicketStatusResponse FromResult(SupportTicketStatusResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new GetSupportTicketStatusResponse(
            result.TicketId,
            result.Provider,
            result.Status,
            result.UploadedFileRef,
            result.ErrorMessage,
            result.CreatedAtUtc,
            result.UploadedAtUtc);
    }
}
