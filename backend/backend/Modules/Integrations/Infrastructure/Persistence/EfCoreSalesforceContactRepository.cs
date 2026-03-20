using backend.Infrastructure.Persistence;
using backend.Modules.Integrations.Domain;
using backend.Modules.Integrations.UseCases.Salesforce;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Integrations.Infrastructure.Persistence;

public sealed class EfCoreSalesforceContactRepository(AppDbContext dbContext) : ISalesforceContactRepository
{
    private const int SalesforceIdMaxLength = 128;
    private const int SyncStatusMaxLength = 32;
    private const int LastErrorMaxLength = 4000;

    public Task<SalesforceContact?> GetByUserIdAsync(
        long userId,
        CancellationToken cancellationToken)
    {
        if (userId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(userId), "User id must be positive.");
        }

        return dbContext.SalesforceContacts
            .AsNoTracking()
            .SingleOrDefaultAsync(contact => contact.UserId == userId, cancellationToken);
    }

    public async Task<SalesforceContact> UpsertAsync(
        long userId,
        string syncStatus,
        string? sfAccountId,
        string? sfContactId,
        DateTime? lastSyncAtUtc,
        string? lastError,
        CancellationToken cancellationToken)
    {
        if (userId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(userId), "User id must be positive.");
        }

        var normalizedStatus = NormalizeRequired(syncStatus, SyncStatusMaxLength, nameof(syncStatus));
        var normalizedAccountId = NormalizeOptional(sfAccountId, SalesforceIdMaxLength);
        var normalizedContactId = NormalizeOptional(sfContactId, SalesforceIdMaxLength);
        var normalizedError = NormalizeOptional(lastError, LastErrorMaxLength);

        var entity = await dbContext.SalesforceContacts
            .SingleOrDefaultAsync(contact => contact.UserId == userId, cancellationToken);

        var now = DateTime.UtcNow;

        if (entity is null)
        {
            entity = new SalesforceContact
            {
                UserId = userId,
                CreatedAtUtc = now
            };

            dbContext.SalesforceContacts.Add(entity);
        }

        entity.SyncStatus = normalizedStatus;
        entity.SfAccountId = normalizedAccountId;
        entity.SfContactId = normalizedContactId;
        entity.LastSyncAtUtc = lastSyncAtUtc;
        entity.LastError = normalizedError;
        entity.UpdatedAtUtc = now;

        return entity;
    }

    private static string NormalizeRequired(string? value, int maxLength, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Value cannot be null or whitespace.", paramName);
        }

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
        {
            throw new ArgumentException($"Value length must be less than or equal to {maxLength}.", paramName);
        }

        return trimmed;
    }

    private static string? NormalizeOptional(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
        {
            return trimmed[..maxLength];
        }

        return trimmed;
    }
}
