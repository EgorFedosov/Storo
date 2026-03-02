namespace backend.Modules.Auth.UseCases.ExternalLogin;

public interface IUserRepository
{
    Task<AuthenticatedUser> UpsertExternalUserAsync(
        ExternalAuthIdentity identity,
        CancellationToken cancellationToken);
}

public sealed record AuthenticatedUser(
    long UserId,
    string Email,
    string DisplayName,
    bool IsBlocked,
    IReadOnlyCollection<string> Roles);
