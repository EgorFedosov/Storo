namespace backend.Modules.Auth.UseCases.CurrentUser;

public interface IUserReadRepository
{
    Task<CurrentUserReadModel?> GetByIdAsync(long userId, CancellationToken cancellationToken);
}

public sealed record CurrentUserReadModel(
    long Id,
    string Email,
    string UserName,
    string DisplayName,
    bool IsBlocked,
    string PreferredLanguage,
    string PreferredTheme,
    IReadOnlyCollection<string> Roles);
