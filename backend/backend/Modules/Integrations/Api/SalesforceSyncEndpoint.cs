using System.Globalization;
using System.Security.Claims;
using backend.Modules.Auth.Api;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Integrations.UseCases.Salesforce;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Integrations.Api;

public static class SalesforceSyncEndpoint
{
    private const int MaxCompanyNameLength = 255;
    private const int MaxJobTitleLength = 128;
    private const int MaxPhoneLength = 64;
    private const int MaxCountryLength = 80;
    private const int MaxNotesLength = 4000;

    public static void MapSalesforceSyncEndpoint(this RouteGroupBuilder apiGroup)
    {
        var salesforceGroup = apiGroup
            .MapGroup("/integrations/salesforce")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status401Unauthorized),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status403Forbidden));

        salesforceGroup
            .MapPost("/sync", SyncAsync)
            .WithName("SyncSalesforceContact")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(SyncSalesforceContactResponse), StatusCodes.Status200OK),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status500InternalServerError),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status502BadGateway))
            .RequireAuthenticatedAccess();

        salesforceGroup
            .MapGet("/me", GetMeAsync)
            .WithName("GetSalesforceMe")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(GetSalesforceMeResponse), StatusCodes.Status200OK),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status500InternalServerError))
            .RequireAuthenticatedAccess();
    }

    private static async Task<Results<Ok<SyncSalesforceContactResponse>, ValidationProblem, ProblemHttpResult>> SyncAsync(
        SyncSalesforceContactRequest request,
        ICurrentUserAccessor currentUserAccessor,
        ISyncSalesforceContactUseCase useCase,
        CancellationToken cancellationToken)
    {
        var currentUser = currentUserAccessor.CurrentUser;
        var actorUserId = currentUser.UserId
                          ?? throw new InvalidOperationException("Authenticated user id claim is missing.");

        var actorEmail = currentUser.Principal.FindFirst(ClaimTypes.Email)?.Value?.Trim();
        var actorDisplayName = currentUser.Principal.FindFirst(ClaimTypes.Name)?.Value?.Trim();
        if (string.IsNullOrWhiteSpace(actorDisplayName))
        {
            actorDisplayName = actorEmail;
        }

        if (!TryCreateCommand(request, actorUserId, actorEmail, actorDisplayName, out var command, out var validationProblem))
        {
            return validationProblem;
        }

        try
        {
            var result = await useCase.ExecuteAsync(command, cancellationToken);
            return TypedResults.Ok(SyncSalesforceContactResponse.FromResult(result));
        }
        catch (SalesforceSyncUpstreamException)
        {
            return CreateProblem(
                StatusCodes.Status502BadGateway,
                "Bad Gateway",
                "Salesforce API request failed while syncing current user.",
                "salesforce_upstream_error");
        }
    }

    private static async Task<Ok<GetSalesforceMeResponse>> GetMeAsync(
        ICurrentUserAccessor currentUserAccessor,
        IGetSalesforceMeUseCase useCase,
        CancellationToken cancellationToken)
    {
        var actorUserId = currentUserAccessor.CurrentUser.UserId
                          ?? throw new InvalidOperationException("Authenticated user id claim is missing.");

        var result = await useCase.ExecuteAsync(
            new GetSalesforceMeQuery(actorUserId),
            cancellationToken);

        return TypedResults.Ok(GetSalesforceMeResponse.FromResult(result));
    }

    private static bool TryCreateCommand(
        SyncSalesforceContactRequest request,
        long actorUserId,
        string? actorEmail,
        string? actorDisplayName,
        out SyncSalesforceContactCommand command,
        out ValidationProblem validationProblem)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        var companyName = request.CompanyName?.Trim();
        if (string.IsNullOrWhiteSpace(companyName))
        {
            errors["companyName"] = ["companyName is required."];
        }
        else if (companyName.Length > MaxCompanyNameLength)
        {
            errors["companyName"] = [$"companyName must be {MaxCompanyNameLength.ToString(CultureInfo.InvariantCulture)} characters or less."];
        }

        var jobTitle = NormalizeOptional(request.JobTitle, MaxJobTitleLength, "jobTitle", errors);
        var phone = NormalizeOptional(request.Phone, MaxPhoneLength, "phone", errors);
        var country = NormalizeOptional(request.Country, MaxCountryLength, "country", errors);
        var notes = NormalizeOptional(request.Notes, MaxNotesLength, "notes", errors);

        if (errors.Count > 0)
        {
            command = null!;
            validationProblem = TypedResults.ValidationProblem(errors);
            return false;
        }

        command = new SyncSalesforceContactCommand(
            companyName!,
            jobTitle,
            phone,
            country,
            notes,
            actorUserId,
            actorEmail,
            actorDisplayName);

        validationProblem = null!;
        return true;
    }

    private static string? NormalizeOptional(
        string? value,
        int maxLength,
        string fieldName,
        IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim();
        if (normalized.Length > maxLength)
        {
            errors[fieldName] = [$"{fieldName} must be {maxLength.ToString(CultureInfo.InvariantCulture)} characters or less."];
            return null;
        }

        return normalized;
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

public sealed record SyncSalesforceContactRequest(
    string? CompanyName,
    string? JobTitle,
    string? Phone,
    string? Country,
    string? Notes);

public sealed record SyncSalesforceContactResponse(
    string SyncStatus,
    string? SfAccountId,
    string? SfContactId,
    DateTime SyncedAt,
    string? ErrorMessage)
{
    public static SyncSalesforceContactResponse FromResult(SyncSalesforceContactResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new SyncSalesforceContactResponse(
            result.SyncStatus,
            result.SfAccountId,
            result.SfContactId,
            result.SyncedAtUtc,
            result.ErrorMessage);
    }
}

public sealed record GetSalesforceMeResponse(
    bool IsLinked,
    string? SfAccountId,
    string? SfContactId,
    string LastSyncStatus,
    DateTime? LastSyncedAt)
{
    public static GetSalesforceMeResponse FromResult(SalesforceMeResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new GetSalesforceMeResponse(
            result.IsLinked,
            result.SfAccountId,
            result.SfContactId,
            result.LastSyncStatus,
            result.LastSyncedAtUtc);
    }
}
