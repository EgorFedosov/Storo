using backend.Modules.Concurrency.UseCases.Versioning;

namespace backend.Modules.Integrations.UseCases.Salesforce;

public sealed class SyncSalesforceContactUseCase(
    ISalesforceAccessTokenClient salesforceAccessTokenClient,
    ISalesforceRestClient salesforceRestClient,
    ISalesforceContactRepository salesforceContactRepository,
    IUnitOfWork unitOfWork) : ISyncSalesforceContactUseCase
{
    private const string SyncedStatus = "Synced";

    private const string PersistedSyncedStatus = "synced";
    private const string PersistedFailedStatus = "failed";
    private const int MaxErrorMessageLength = 4000;

    public async Task<SyncSalesforceContactResult> ExecuteAsync(
        SyncSalesforceContactCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        if (command.ActorUserId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(command.ActorUserId), "Actor user id must be positive.");
        }

        var companyName = NormalizeRequired(command.CompanyName, nameof(command.CompanyName));
        var jobTitle = NormalizeOptional(command.JobTitle);
        var phone = NormalizeOptional(command.Phone);
        var country = NormalizeOptional(command.Country);
        var notes = NormalizeOptional(command.Notes);
        var actorEmail = NormalizeOptional(command.ActorEmail);
        var actorDisplayName = NormalizeOptional(command.ActorDisplayName);
        var contactLastName = ResolveContactLastName(actorDisplayName, actorEmail, command.ActorUserId);

        var syncedAtUtc = DateTime.UtcNow;
        string? sfAccountId = null;

        try
        {
            var accessTokenResult = await salesforceAccessTokenClient.GetAccessTokenAsync(cancellationToken);

            var createAccountResult = await salesforceRestClient.CreateAccountAsync(
                new SalesforceCreateAccountRequest(
                    accessTokenResult.AccessToken,
                    companyName),
                cancellationToken);

            sfAccountId = createAccountResult.SfAccountId;

            var createContactResult = await salesforceRestClient.CreateContactAsync(
                new SalesforceCreateContactRequest(
                    accessTokenResult.AccessToken,
                    sfAccountId,
                    contactLastName,
                    actorEmail,
                    phone,
                    jobTitle,
                    country,
                    notes),
                cancellationToken);

            await salesforceContactRepository.UpsertAsync(
                command.ActorUserId,
                PersistedSyncedStatus,
                sfAccountId,
                createContactResult.SfContactId,
                syncedAtUtc,
                null,
                cancellationToken);

            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new SyncSalesforceContactResult(
                SyncedStatus,
                sfAccountId,
                createContactResult.SfContactId,
                syncedAtUtc,
                null);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception) when (IsSalesforceUpstreamException(exception))
        {
            await salesforceContactRepository.UpsertAsync(
                command.ActorUserId,
                PersistedFailedStatus,
                sfAccountId,
                null,
                syncedAtUtc,
                Truncate(exception.Message, MaxErrorMessageLength),
                cancellationToken);

            await unitOfWork.SaveChangesAsync(cancellationToken);

            throw new SalesforceSyncUpstreamException(
                "Salesforce sync failed because Salesforce API request was unsuccessful.",
                exception);
        }
    }

    private static bool IsSalesforceUpstreamException(Exception exception)
    {
        return exception is HttpRequestException or InvalidOperationException;
    }

    private static string NormalizeRequired(string? value, string parameterName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Value cannot be null or whitespace.", parameterName);
        }

        return value.Trim();
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }

    private static string ResolveContactLastName(
        string? actorDisplayName,
        string? actorEmail,
        long actorUserId)
    {
        if (!string.IsNullOrWhiteSpace(actorDisplayName))
        {
            var nameParts = actorDisplayName.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (nameParts.Length > 0)
            {
                return nameParts[^1];
            }
        }

        if (!string.IsNullOrWhiteSpace(actorEmail))
        {
            var localPart = actorEmail.Split('@', 2, StringSplitOptions.TrimEntries)[0];
            if (!string.IsNullOrWhiteSpace(localPart))
            {
                return localPart;
            }
        }

        return $"User{actorUserId}";
    }

    private static string Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength)
        {
            return value ?? string.Empty;
        }

        return value[..maxLength];
    }
}
