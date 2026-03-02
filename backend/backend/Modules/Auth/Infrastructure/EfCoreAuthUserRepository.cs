using backend.Infrastructure.Persistence;
using backend.Modules.Auth.UseCases.ExternalLogin;
using backend.Modules.Users.Domain;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Auth.Infrastructure;

public sealed class EfCoreAuthUserRepository(AppDbContext dbContext) : IUserRepository
{
    private const string DefaultPreferredLanguage = "en";
    private const string DefaultPreferredTheme = "light";
    private const string DefaultUserRoleName = "user";

    public async Task<AuthenticatedUser> UpsertExternalUserAsync(
        ExternalAuthIdentity identity,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(identity);
        cancellationToken.ThrowIfCancellationRequested();

        var provider = NormalizeProvider(identity.Provider);
        var providerUserId = NormalizeRequired(identity.ProviderUserId, nameof(identity.ProviderUserId));
        var email = NormalizeRequired(identity.Email, nameof(identity.Email));
        var normalizedEmail = email.ToUpperInvariant();
        var displayName = string.IsNullOrWhiteSpace(identity.DisplayName)
            ? email
            : identity.DisplayName.Trim();
        var now = DateTime.UtcNow;

        var existingAccount = await dbContext.ExternalAuthAccounts
            .Include(account => account.User)
                .ThenInclude(user => user.UserRoles)
                    .ThenInclude(userRole => userRole.Role)
            .SingleOrDefaultAsync(
                account => account.Provider == provider && account.ProviderUserId == providerUserId,
                cancellationToken);

        User user;
        if (existingAccount is not null)
        {
            user = existingAccount.User;
            UpdateUser(user, displayName, now);
        }
        else
        {
            user = await dbContext.Users
                .Include(candidate => candidate.ExternalAuthAccounts)
                .Include(candidate => candidate.UserRoles)
                    .ThenInclude(userRole => userRole.Role)
                .SingleOrDefaultAsync(candidate => candidate.NormalizedEmail == normalizedEmail, cancellationToken)
                ?? await CreateUserAsync(email, normalizedEmail, displayName, now, cancellationToken);

            UpdateUser(user, displayName, now);
            EnsureExternalAccount(user, provider, providerUserId, now);
        }

        await EnsureDefaultRoleAsync(user, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        var roles = user.UserRoles
            .Select(userRole => userRole.Role.Name)
            .Where(static roleName => !string.IsNullOrWhiteSpace(roleName))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        return new AuthenticatedUser(user.Id, user.Email, user.DisplayName, user.IsBlocked, roles);
    }

    private static void UpdateUser(User user, string displayName, DateTime now)
    {
        user.DisplayName = displayName;
        user.UpdatedAt = now;
    }

    private async Task<User> CreateUserAsync(
        string email,
        string normalizedEmail,
        string displayName,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var userName = await GenerateUniqueUserNameAsync(email, cancellationToken);
        var normalizedUserName = userName.ToUpperInvariant();

        var user = new User
        {
            Email = email,
            NormalizedEmail = normalizedEmail,
            UserName = userName,
            NormalizedUserName = normalizedUserName,
            DisplayName = displayName,
            IsBlocked = false,
            PreferredLanguage = DefaultPreferredLanguage,
            PreferredTheme = DefaultPreferredTheme,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Users.Add(user);
        return user;
    }

    private static void EnsureExternalAccount(User user, string provider, string providerUserId, DateTime now)
    {
        var existingProviderAccount = user.ExternalAuthAccounts
            .SingleOrDefault(account => account.Provider == provider);

        if (existingProviderAccount is null)
        {
            user.ExternalAuthAccounts.Add(new ExternalAuthAccount
            {
                Provider = provider,
                ProviderUserId = providerUserId,
                CreatedAt = now
            });
            return;
        }

        existingProviderAccount.ProviderUserId = providerUserId;
    }

    private async Task EnsureDefaultRoleAsync(User user, CancellationToken cancellationToken)
    {
        if (user.UserRoles.Any(userRole =>
                string.Equals(userRole.Role.Name, DefaultUserRoleName, StringComparison.OrdinalIgnoreCase)))
        {
            return;
        }

        var defaultRole = await dbContext.Roles
            .SingleOrDefaultAsync(role => role.Name == DefaultUserRoleName, cancellationToken)
            ?? throw new InvalidOperationException("Default 'user' role is missing.");

        user.UserRoles.Add(new UserRole
        {
            User = user,
            Role = defaultRole,
            RoleId = defaultRole.Id
        });
    }

    private async Task<string> GenerateUniqueUserNameAsync(string email, CancellationToken cancellationToken)
    {
        var localPart = email.Split('@', 2, StringSplitOptions.TrimEntries)[0];
        var baseUserName = SanitizeUserName(localPart);
        if (string.IsNullOrWhiteSpace(baseUserName))
        {
            baseUserName = "user";
        }

        var candidate = baseUserName;
        var suffix = 1;

        while (await IsUserNameTakenAsync(candidate, cancellationToken))
        {
            candidate = $"{baseUserName}{suffix}";
            suffix++;
        }

        return candidate;
    }

    private async Task<bool> IsUserNameTakenAsync(string userName, CancellationToken cancellationToken)
    {
        var normalizedUserName = userName.ToUpperInvariant();
        return await dbContext.Users
            .AnyAsync(user => user.NormalizedUserName == normalizedUserName, cancellationToken);
    }

    private static string SanitizeUserName(string source)
    {
        var filtered = source
            .Where(static character => char.IsLetterOrDigit(character) || character is '-' or '_' or '.')
            .Take(40)
            .ToArray();

        return new string(filtered);
    }

    private static string NormalizeProvider(string provider)
    {
        return NormalizeRequired(provider, nameof(provider)).ToLowerInvariant();
    }

    private static string NormalizeRequired(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Value cannot be null or whitespace.", paramName);
        }

        return value.Trim();
    }
}
