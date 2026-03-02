using backend.Modules.Auth.UseCases.Authorization;

namespace backend.Modules.Auth.UseCases.CurrentUser;

public sealed class GetCurrentUserUseCase(
    ICurrentUserAccessor currentUserAccessor,
    IUserReadRepository userReadRepository,
    IPermissionService permissionService) : IGetCurrentUserUseCase
{
    private const string DefaultPreferredLanguage = "en";
    private const string DefaultPreferredTheme = "light";

    public async Task<CurrentUserResult> ExecuteAsync(GetCurrentUserQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var currentUser = currentUserAccessor.CurrentUser;
        if (!currentUser.IsAuthenticated || currentUser.UserId is null)
        {
            return CreateGuestResult();
        }

        var user = await userReadRepository.GetByIdAsync(currentUser.UserId.Value, cancellationToken);
        if (user is null)
        {
            return CreateGuestResult();
        }

        var roles = user.Roles
            .Where(static role => !string.IsNullOrWhiteSpace(role))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(static role => role, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var preferences = new CurrentUserPreferencesResult(
            NormalizePreference(user.PreferredLanguage, DefaultPreferredLanguage),
            NormalizePreference(user.PreferredTheme, DefaultPreferredTheme));

        var permissions = permissionService.GetCurrentUserPermissions(
            new CurrentUserPermissionContext(true, user.IsBlocked, roles));

        var identity = new CurrentUserIdentityResult(
            user.Id,
            user.Email,
            user.UserName,
            user.DisplayName,
            user.IsBlocked);

        return new CurrentUserResult(true, identity, roles, preferences, permissions);
    }

    private CurrentUserResult CreateGuestResult()
    {
        var roles = Array.Empty<string>();
        var permissions = permissionService.GetCurrentUserPermissions(
            new CurrentUserPermissionContext(false, false, roles));

        return new CurrentUserResult(
            false,
            null,
            roles,
            new CurrentUserPreferencesResult(DefaultPreferredLanguage, DefaultPreferredTheme),
            permissions);
    }

    private static string NormalizePreference(string? value, string fallback)
    {
        return string.IsNullOrWhiteSpace(value)
            ? fallback
            : value.Trim();
    }
}
