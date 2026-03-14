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
        var localEmail = await BuildUniqueLocalEmailAsync(userName, normalizedLogin, cancellationToken);
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

    private async Task<string> BuildUniqueLocalEmailAsync(
        string login,
        string normalizedLogin,
        CancellationToken cancellationToken)
    {
        var localPart = BuildEmailLocalPart(login);
        var baseEmail = $"{localPart}@storo.local";
        var normalizedBaseEmail = baseEmail.ToUpperInvariant();

        var emailTaken = await dbContext.Users
            .AnyAsync(user => user.NormalizedEmail == normalizedBaseEmail, cancellationToken);
        if (!emailTaken)
        {
            return baseEmail;
        }

        var loginHash = SHA256.HashData(Encoding.UTF8.GetBytes(normalizedLogin));
        var hashSuffix = Convert.ToHexString(loginHash)[..8].ToLowerInvariant();

        const int maxLocalPartLength = 64;
        var allowedBaseLength = maxLocalPartLength - hashSuffix.Length - 1;
        var truncatedBase = localPart.Length > allowedBaseLength
            ? localPart[..allowedBaseLength].Trim('.')
            : localPart;
        if (string.IsNullOrWhiteSpace(truncatedBase))
        {
            truncatedBase = "localuser";
        }

        return $"{truncatedBase}.{hashSuffix}@storo.local";
    }

    private static string BuildEmailLocalPart(string login)
    {
        var trimmedLogin = login.Trim().ToLowerInvariant();
        if (trimmedLogin.Length == 0)
        {
            return "localuser";
        }

        var localPartBuilder = new StringBuilder(trimmedLogin.Length);

        foreach (var character in trimmedLogin)
        {
            if (char.IsLetterOrDigit(character))
            {
                localPartBuilder.Append(character);
                continue;
            }

            if (character is '_' or '.' or '-')
            {
                localPartBuilder.Append(character == '_' ? '.' : character);
                continue;
            }

            localPartBuilder.Append('.');
        }

        var normalizedLocalPart = CollapseDots(localPartBuilder.ToString()).Trim('.');
        if (normalizedLocalPart.Length == 0)
        {
            return "localuser";
        }

        const int maxLocalPartLength = 64;
        if (normalizedLocalPart.Length <= maxLocalPartLength)
        {
            return normalizedLocalPart;
        }

        var truncated = normalizedLocalPart[..maxLocalPartLength].Trim('.');
        return string.IsNullOrWhiteSpace(truncated)
            ? "localuser"
            : truncated;
    }

    private static string CollapseDots(string value)
    {
        if (value.Length == 0)
        {
            return value;
        }

        var result = new StringBuilder(value.Length);
        var previousWasDot = false;

        foreach (var character in value)
        {
            if (character == '.')
            {
                if (previousWasDot)
                {
                    continue;
                }

                previousWasDot = true;
                result.Append(character);
                continue;
            }

            previousWasDot = false;
            result.Append(character);
        }

        return result.ToString();
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
