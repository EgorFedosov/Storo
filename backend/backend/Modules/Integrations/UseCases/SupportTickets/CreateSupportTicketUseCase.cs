using System.Globalization;
using System.Text.Json;
using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Integrations.Domain;
using backend.Modules.Integrations.UseCases.Dropbox;

namespace backend.Modules.Integrations.UseCases.SupportTickets;

public sealed class CreateSupportTicketUseCase(
    ISupportTicketExportRepository supportTicketExportRepository,
    IDropboxAccessTokenClient dropboxAccessTokenClient,
    IDropboxUploadClient dropboxUploadClient,
    IUnitOfWork unitOfWork) : ICreateSupportTicketUseCase
{
    private const int PayloadSchemaVersion = 1;
    private const int MaxErrorMessageLength = 4000;

    private const string DropboxProvider = "dropbox";
    private const string PendingStatus = "pending";
    private const string UploadedStatus = "uploaded";
    private const string FailedStatus = "failed";

    private static readonly JsonSerializerOptions JsonSerializerOptions = new(JsonSerializerDefaults.Web);

    public async Task<CreateSupportTicketResult> ExecuteAsync(
        CreateSupportTicketCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        var provider = command.Provider.Trim().ToLowerInvariant();
        if (!string.Equals(provider, DropboxProvider, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Only Dropbox provider is supported.");
        }

        var inventoryContext = await ResolveInventoryContextAsync(command, cancellationToken);
        var adminsEmails = await supportTicketExportRepository.ListAdminEmailsAsync(cancellationToken);

        var ticketId = GenerateTicketId();
        var createdAtUtc = DateTime.UtcNow;
        var supportTicketExport = new SupportTicketExport
        {
            TicketId = ticketId,
            ReportedByUserId = command.ActorUserId,
            InventoryId = command.InventoryId,
            Summary = command.Summary,
            Priority = command.Priority,
            PageLink = command.PageLink,
            Provider = DropboxProvider,
            AdminsEmailsSnapshot = JsonSerializer.Serialize(adminsEmails, JsonSerializerOptions),
            Status = PendingStatus,
            CreatedAtUtc = createdAtUtc
        };

        await supportTicketExportRepository.AddAsync(supportTicketExport, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        try
        {
            var payloadJson = BuildDropboxPayloadJson(
                ticketId,
                createdAtUtc,
                command,
                inventoryContext,
                adminsEmails);

            var accessTokenResult = await dropboxAccessTokenClient.GetAccessTokenAsync(cancellationToken);
            var uploadResult = await dropboxUploadClient.UploadJsonAsync(
                new DropboxJsonUploadRequest(
                    accessTokenResult.AccessToken,
                    BuildTicketFileName(ticketId),
                    payloadJson),
                cancellationToken);

            supportTicketExport.Status = UploadedStatus;
            supportTicketExport.UploadedFileRef = uploadResult.PathDisplay;
            supportTicketExport.ProviderFileId = uploadResult.FileId;
            supportTicketExport.ProviderRev = uploadResult.Rev;
            supportTicketExport.UploadedAtUtc = uploadResult.ServerModifiedUtc;
            supportTicketExport.ErrorMessage = null;

            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new CreateSupportTicketResult(
                ticketId,
                DropboxProvider,
                UploadedStatus,
                uploadResult.PathDisplay,
                createdAtUtc);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception) when (IsDropboxUpstreamException(exception))
        {
            supportTicketExport.Status = FailedStatus;
            supportTicketExport.UploadedFileRef = null;
            supportTicketExport.ProviderFileId = null;
            supportTicketExport.ProviderRev = null;
            supportTicketExport.UploadedAtUtc = null;
            supportTicketExport.ErrorMessage = Truncate(exception.Message, MaxErrorMessageLength);

            await unitOfWork.SaveChangesAsync(cancellationToken);

            throw new SupportTicketDropboxUpstreamException(
                "Support ticket export failed because Dropbox API request was unsuccessful.",
                exception);
        }
    }

    private async Task<SupportTicketInventoryContext?> ResolveInventoryContextAsync(
        CreateSupportTicketCommand command,
        CancellationToken cancellationToken)
    {
        if (!command.InventoryId.HasValue)
        {
            return null;
        }

        var inventoryContext = await supportTicketExportRepository.GetInventoryContextAsync(
            command.InventoryId.Value,
            command.ActorUserId,
            cancellationToken);

        if (inventoryContext is null || !CanUseInventoryContext(inventoryContext, command.ActorUserId, command.ActorIsAdmin))
        {
            throw new SupportTicketInventoryAccessDeniedException(command.InventoryId.Value, command.ActorUserId);
        }

        return inventoryContext;
    }

    private static bool CanUseInventoryContext(
        SupportTicketInventoryContext inventoryContext,
        long actorUserId,
        bool actorIsAdmin)
    {
        if (actorIsAdmin || inventoryContext.CreatorUserId == actorUserId || inventoryContext.IsPublic)
        {
            return true;
        }

        return inventoryContext.ActorHasExplicitAccess;
    }

    private static string BuildDropboxPayloadJson(
        string ticketId,
        DateTime createdAtUtc,
        CreateSupportTicketCommand command,
        SupportTicketInventoryContext? inventoryContext,
        IReadOnlyList<string> adminsEmails)
    {
        var payload = new SupportTicketDropboxPayload(
            PayloadSchemaVersion,
            ticketId,
            createdAtUtc,
            new SupportTicketDropboxReportedByPayload(
                command.ActorUserId.ToString(CultureInfo.InvariantCulture),
                command.ActorEmail,
                command.ActorDisplayName),
            command.Summary,
            command.Priority,
            command.PageLink,
            inventoryContext is null
                ? null
                : new SupportTicketDropboxInventoryPayload(
                    inventoryContext.InventoryId.ToString(CultureInfo.InvariantCulture),
                    inventoryContext.InventoryTitle),
            adminsEmails,
            DropboxProvider);

        return JsonSerializer.Serialize(payload, JsonSerializerOptions);
    }

    private static bool IsDropboxUpstreamException(Exception exception)
    {
        return exception is HttpRequestException or InvalidOperationException;
    }

    private static string GenerateTicketId()
    {
        return $"st_{Guid.NewGuid():N}";
    }

    private static string BuildTicketFileName(string ticketId)
    {
        return $"ticket-{ticketId}.json";
    }

    private static string Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength)
        {
            return value ?? string.Empty;
        }

        return value[..maxLength];
    }

    private sealed record SupportTicketDropboxPayload(
        int SchemaVersion,
        string TicketId,
        DateTime CreatedAtUtc,
        SupportTicketDropboxReportedByPayload ReportedBy,
        string Summary,
        string Priority,
        string PageLink,
        SupportTicketDropboxInventoryPayload? Inventory,
        IReadOnlyList<string> AdminsEmails,
        string Provider);

    private sealed record SupportTicketDropboxReportedByPayload(
        string UserId,
        string Email,
        string DisplayName);

    private sealed record SupportTicketDropboxInventoryPayload(
        string Id,
        string Title);
}
