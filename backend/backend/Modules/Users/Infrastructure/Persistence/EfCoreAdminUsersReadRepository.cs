using backend.Infrastructure.Persistence;
using backend.Modules.Users.Domain;
using backend.Modules.Users.UseCases.ListUsersForAdmin;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Users.Infrastructure.Persistence;

public sealed class EfCoreAdminUsersReadRepository(AppDbContext dbContext) : IAdminUsersReadRepository
{
    private const string AdminRoleName = "admin";

    public async Task<AdminUsersPageResult> ListAsync(
        AdminUsersReadRepositoryQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var usersQuery = dbContext.Users.AsNoTracking();
        usersQuery = ApplyBlockedFilter(usersQuery, query.IsBlocked);
        usersQuery = ApplyRoleFilter(usersQuery, query.RoleFilter);
        usersQuery = ApplySearchFilter(usersQuery, query.SearchQuery);
        usersQuery = ApplySort(usersQuery, query.SortField, query.SortDirection);

        var totalCount = await usersQuery.CountAsync(cancellationToken);
        var skip = (query.Page - 1) * query.PageSize;

        var items = await usersQuery
            .Skip(skip)
            .Take(query.PageSize)
            .Select(user => new AdminUserListItemResult(
                user.Id,
                user.Email,
                user.UserName,
                user.DisplayName,
                user.IsBlocked,
                user.UserRoles
                    .Select(userRole => userRole.Role.Name)
                    .Where(name => !string.IsNullOrWhiteSpace(name))
                    .Distinct()
                    .OrderBy(name => name)
                    .ToArray(),
                user.CreatedAt,
                user.UpdatedAt))
            .ToArrayAsync(cancellationToken);

        return new AdminUsersPageResult(
            items,
            query.Page,
            query.PageSize,
            totalCount,
            new AdminUsersSortResult(query.SortField, query.SortDirection));
    }

    private static IQueryable<User> ApplyBlockedFilter(IQueryable<User> source, bool? isBlocked)
    {
        if (isBlocked is null)
        {
            return source;
        }

        return source.Where(user => user.IsBlocked == isBlocked.Value);
    }

    private static IQueryable<User> ApplyRoleFilter(IQueryable<User> source, AdminUsersRoleFilter roleFilter)
    {
        return roleFilter switch
        {
            AdminUsersRoleFilter.Admin => source.Where(
                user => user.UserRoles.Any(userRole => userRole.Role.Name == AdminRoleName)),
            AdminUsersRoleFilter.User => source.Where(
                user => user.UserRoles.All(userRole => userRole.Role.Name != AdminRoleName)),
            _ => source
        };
    }

    private static IQueryable<User> ApplySearchFilter(IQueryable<User> source, string? searchQuery)
    {
        if (string.IsNullOrWhiteSpace(searchQuery))
        {
            return source;
        }

        var pattern = $"%{searchQuery}%";

        return source.Where(user =>
            EF.Functions.ILike(user.UserName, pattern) ||
            EF.Functions.ILike(user.Email, pattern));
    }

    private static IQueryable<User> ApplySort(
        IQueryable<User> source,
        AdminUsersSortField field,
        AdminUsersSortDirection direction)
    {
        return (field, direction) switch
        {
            (AdminUsersSortField.UpdatedAt, AdminUsersSortDirection.Asc) => source
                .OrderBy(user => user.UpdatedAt)
                .ThenBy(user => user.Id),
            (AdminUsersSortField.UpdatedAt, AdminUsersSortDirection.Desc) => source
                .OrderByDescending(user => user.UpdatedAt)
                .ThenBy(user => user.Id),
            (AdminUsersSortField.CreatedAt, AdminUsersSortDirection.Asc) => source
                .OrderBy(user => user.CreatedAt)
                .ThenBy(user => user.Id),
            (AdminUsersSortField.CreatedAt, AdminUsersSortDirection.Desc) => source
                .OrderByDescending(user => user.CreatedAt)
                .ThenBy(user => user.Id),
            (AdminUsersSortField.UserName, AdminUsersSortDirection.Asc) => source
                .OrderBy(user => user.UserName)
                .ThenBy(user => user.Id),
            (AdminUsersSortField.UserName, AdminUsersSortDirection.Desc) => source
                .OrderByDescending(user => user.UserName)
                .ThenBy(user => user.Id),
            (AdminUsersSortField.Email, AdminUsersSortDirection.Asc) => source
                .OrderBy(user => user.Email)
                .ThenBy(user => user.Id),
            (AdminUsersSortField.Email, AdminUsersSortDirection.Desc) => source
                .OrderByDescending(user => user.Email)
                .ThenBy(user => user.Id),
            _ => source
                .OrderByDescending(user => user.UpdatedAt)
                .ThenBy(user => user.Id)
        };
    }
}
