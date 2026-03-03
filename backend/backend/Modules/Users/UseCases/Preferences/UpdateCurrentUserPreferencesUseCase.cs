using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Concurrency.UseCases.Versioning;

namespace backend.Modules.Users.UseCases.Preferences;

public sealed class UpdateCurrentUserPreferencesUseCase(
    ICurrentUserAccessor currentUserAccessor,
    IUserRepository userRepository,
    IUnitOfWork unitOfWork) : IUpdateCurrentUserPreferencesUseCase
{
    public async Task<UserPreferencesResult> ExecuteAsync(
        UpdateCurrentUserPreferencesCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        var currentUserId = currentUserAccessor.CurrentUser.UserId
            ?? throw new InvalidOperationException("Authenticated user id claim is missing.");

        var user = await userRepository.GetByIdAsync(currentUserId, cancellationToken)
            ?? throw new InvalidOperationException($"Current user '{currentUserId}' was not found.");

        var normalizedLanguage = NormalizeLanguage(command.Language);
        var normalizedTheme = NormalizeTheme(command.Theme);

        if (!string.Equals(user.PreferredLanguage, normalizedLanguage, StringComparison.Ordinal) ||
            !string.Equals(user.PreferredTheme, normalizedTheme, StringComparison.Ordinal))
        {
            user.PreferredLanguage = normalizedLanguage;
            user.PreferredTheme = normalizedTheme;
            user.UpdatedAt = DateTime.UtcNow;

            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return new UserPreferencesResult(user.PreferredLanguage, user.PreferredTheme);
    }

    private static string NormalizeLanguage(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Language is required.", nameof(value));
        }

        return value.Trim().ToLowerInvariant();
    }

    private static string NormalizeTheme(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Theme is required.", nameof(value));
        }

        return value.Trim().ToLowerInvariant();
    }
}
