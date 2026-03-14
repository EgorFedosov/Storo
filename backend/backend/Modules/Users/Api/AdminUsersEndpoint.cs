using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Users.UseCases.ListUsersForAdmin;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Users.Api;

public static class AdminUsersEndpoint
{
    private const int DefaultPage = 1;
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;

    public static void MapAdminUsersEndpoint(this RouteGroupBuilder apiGroup)
    {
        apiGroup
            .MapGet("/admin/users", ListAsync)
            .WithName("ListUsersForAdmin")
            .RequireAuthorization(AuthorizationPolicies.Authenticated)
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status401Unauthorized),
                new ProducesResponseTypeAttribute(typeof(ProblemDetails), StatusCodes.Status403Forbidden),
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest));
    }

    private static async Task<Results<Ok<AdminUsersPageResponse>, ValidationProblem>> ListAsync(
        [AsParameters] ListUsersForAdminRequest request,
        IListUsersForAdminUseCase useCase,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        var blocked = ParseBlockedFilter(request.Blocked, errors);
        var roleFilter = ParseRoleFilter(request.Role, errors);
        var sortField = ParseSortField(request.SortField, errors);
        var sortDirection = ParseSortDirection(request.SortDirection, errors);
        var page = ParsePage(request.Page, errors);
        var pageSize = ParsePageSize(request.PageSize, errors);

        if (errors.Count > 0
            || roleFilter is null
            || sortField is null
            || sortDirection is null
            || page is null
            || pageSize is null)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var query = new ListUsersForAdminQuery(
            blocked,
            roleFilter.Value,
            request.Query,
            page.Value,
            pageSize.Value,
            sortField.Value,
            sortDirection.Value);

        var result = await useCase.ExecuteAsync(query, cancellationToken);
        return TypedResults.Ok(AdminUsersPageResponse.FromResult(result));
    }

    private static bool? ParseBlockedFilter(string? rawValue, IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return null;
        }

        var value = rawValue.Trim();

        if (string.Equals(value, "all", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        if (bool.TryParse(value, out var blocked))
        {
            return blocked;
        }

        errors["blocked"] = ["blocked must be one of: all, true, false."];
        return null;
    }

    private static AdminUsersRoleFilter? ParseRoleFilter(string? rawValue, IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return AdminUsersRoleFilter.All;
        }

        var value = rawValue.Trim();

        if (string.Equals(value, "all", StringComparison.OrdinalIgnoreCase))
        {
            return AdminUsersRoleFilter.All;
        }

        if (string.Equals(value, "admin", StringComparison.OrdinalIgnoreCase))
        {
            return AdminUsersRoleFilter.Admin;
        }

        if (string.Equals(value, "user", StringComparison.OrdinalIgnoreCase))
        {
            return AdminUsersRoleFilter.User;
        }

        errors["role"] = ["role must be one of: all, admin, user."];
        return null;
    }

    private static AdminUsersSortField? ParseSortField(string? rawValue, IDictionary<string, string[]> errors)
    {
        var value = string.IsNullOrWhiteSpace(rawValue) ? "updatedAt" : rawValue.Trim();

        if (string.Equals(value, "updatedAt", StringComparison.OrdinalIgnoreCase))
        {
            return AdminUsersSortField.UpdatedAt;
        }

        if (string.Equals(value, "createdAt", StringComparison.OrdinalIgnoreCase))
        {
            return AdminUsersSortField.CreatedAt;
        }

        if (string.Equals(value, "userName", StringComparison.OrdinalIgnoreCase))
        {
            return AdminUsersSortField.UserName;
        }

        if (string.Equals(value, "email", StringComparison.OrdinalIgnoreCase))
        {
            return AdminUsersSortField.Email;
        }

        errors["sortField"] = ["sortField must be one of: updatedAt, createdAt, userName, email."];
        return null;
    }

    private static AdminUsersSortDirection? ParseSortDirection(
        string? rawValue,
        IDictionary<string, string[]> errors)
    {
        var value = string.IsNullOrWhiteSpace(rawValue) ? "desc" : rawValue.Trim();

        if (string.Equals(value, "asc", StringComparison.OrdinalIgnoreCase))
        {
            return AdminUsersSortDirection.Asc;
        }

        if (string.Equals(value, "desc", StringComparison.OrdinalIgnoreCase))
        {
            return AdminUsersSortDirection.Desc;
        }

        errors["sortDirection"] = ["sortDirection must be one of: asc, desc."];
        return null;
    }

    private static int? ParsePage(int? rawValue, IDictionary<string, string[]> errors)
    {
        var value = rawValue ?? DefaultPage;
        if (value >= 1)
        {
            return value;
        }

        errors["page"] = ["page must be greater than or equal to 1."];
        return null;
    }

    private static int? ParsePageSize(int? rawValue, IDictionary<string, string[]> errors)
    {
        var value = rawValue ?? DefaultPageSize;
        if (value is >= 1 and <= MaxPageSize)
        {
            return value;
        }

        errors["pageSize"] = [$"pageSize must be between 1 and {MaxPageSize}."];
        return null;
    }
}

public sealed record ListUsersForAdminRequest(
    [property: FromQuery(Name = "blocked")] string? Blocked,
    [property: FromQuery(Name = "role")] string? Role,
    [property: FromQuery(Name = "query")] string? Query,
    [property: FromQuery(Name = "sortField")] string? SortField,
    [property: FromQuery(Name = "sortDirection")] string? SortDirection,
    [property: FromQuery(Name = "page")] int? Page,
    [property: FromQuery(Name = "pageSize")] int? PageSize);
