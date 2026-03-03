namespace backend.Modules.Users.UseCases.ListUsersForAdmin;

public sealed class ListUsersForAdminUseCase(
    IAdminUsersReadRepository adminUsersReadRepository) : IListUsersForAdminUseCase
{
    public async Task<AdminUsersPageResult> ExecuteAsync(
        ListUsersForAdminQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var readQuery = new AdminUsersReadRepositoryQuery(
            query.IsBlocked,
            query.RoleFilter,
            NormalizeSearchQuery(query.SearchQuery),
            query.Page,
            query.PageSize,
            query.SortField,
            query.SortDirection);

        return await adminUsersReadRepository.ListAsync(readQuery, cancellationToken);
    }

    private static string? NormalizeSearchQuery(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
    }
}
