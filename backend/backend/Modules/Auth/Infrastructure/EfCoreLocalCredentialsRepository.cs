using backend.Infrastructure.Persistence;
using backend.Modules.Auth.UseCases.ExternalLogin;
using backend.Modules.Auth.UseCases.LocalAuth;
using backend.Modules.Users.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;

namespace backend.Modules.Auth.Infrastructure;

public sealed class EfCoreLocalCredentialsRepository(
    AppDbContext dbContext,
    IPasswordHasher<User> passwordHasher) : ILocalCredentialsRepository
{
    private const string DefaultPreferredLanguage = "en";
    private const string DefaultPreferredTheme = "light";
    private const string DefaultUserRoleName = "user";

    public async Task<LocalAuthResult> RegisterAsync(
        string login,
        string password,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var normalizedLogin = NormalizeLogin(login);

        var userNameTaken = await dbContext.Users
            .AnyAsync(user => user.NormalizedUserName == normalizedLogin, cancellationToken);
        if (userNameTaken)
        {
            return LocalAuthResult.Fail(LocalAuthStatus.LoginAlreadyTaken);
        }

        var now = DateTime.UtcNow;
        var userName = login.Trim();
        var localEmail = BuildLocalEmail(userName);
        var user = new User
        {
            Email = localEmail,
            NormalizedEmail = localEmail.ToUpperInvariant(),
            UserName = userName,
            NormalizedUserName = normalizedLogin,
            DisplayName = userName,
            PasswordHash = string.Empty,
            IsBlocked = false,
            PreferredLanguage = DefaultPreferredLanguage,
            PreferredTheme = DefaultPreferredTheme,
            CreatedAt = now,
            UpdatedAt = now
        };

        user.PasswordHash = passwordHasher.HashPassword(user, password);

        var defaultRole = await dbContext.Roles
            .SingleOrDefaultAsync(role => role.Name == DefaultUserRoleName, cancellationToken)
            ?? throw new InvalidOperationException("Default 'user' role is missing.");

        user.UserRoles.Add(new UserRole
        {
            User = user,
            Role = defaultRole,
            RoleId = defaultRole.Id
        });

        dbContext.Users.Add(user);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return LocalAuthResult.Fail(LocalAuthStatus.LoginAlreadyTaken);
        }

        return LocalAuthResult.Success(ToAuthenticatedUser(user));
    }

    public async Task<LocalAuthResult> AuthenticateAsync(
        string login,
        string password,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var normalizedLogin = NormalizeLogin(login);

        var user = await dbContext.Users
            .Include(candidate => candidate.UserRoles)
                .ThenInclude(userRole => userRole.Role)
            .SingleOrDefaultAsync(
                candidate => candidate.NormalizedUserName == normalizedLogin
                             || candidate.NormalizedEmail == normalizedLogin,
                cancellationToken);

        if (user is null || string.IsNullOrWhiteSpace(user.PasswordHash))
        {
            return LocalAuthResult.Fail(LocalAuthStatus.InvalidCredentials);
        }

        var verificationResult = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, password);
        if (verificationResult == PasswordVerificationResult.Failed)
        {
            return LocalAuthResult.Fail(LocalAuthStatus.InvalidCredentials);
        }

        if (user.IsBlocked)
        {
            return LocalAuthResult.Fail(LocalAuthStatus.UserBlocked);
        }

        if (verificationResult == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = passwordHasher.HashPassword(user, password);
            user.UpdatedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return LocalAuthResult.Success(ToAuthenticatedUser(user));
    }

    private static string NormalizeLogin(string login)
    {
        if (string.IsNullOrWhiteSpace(login))
        {
            throw new ArgumentException("Login cannot be empty.", nameof(login));
        }

        return login.Trim().ToUpperInvariant();
    }

    private static string BuildLocalEmail(string login)
    {
        var normalizedLogin = login.Trim().ToUpperInvariant();
        var loginHash = SHA256.HashData(Encoding.UTF8.GetBytes(normalizedLogin));
        var hashHex = Convert.ToHexString(loginHash).ToLowerInvariant();
        return $"local+{hashHex}@storo.local";
    }

    private static AuthenticatedUser ToAuthenticatedUser(User user)
    {
        var roles = user.UserRoles
            .Select(userRole => userRole.Role.Name)
            .Where(static roleName => !string.IsNullOrWhiteSpace(roleName))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        return new AuthenticatedUser(user.Id, user.Email, user.DisplayName, user.IsBlocked, roles);
    }
}
