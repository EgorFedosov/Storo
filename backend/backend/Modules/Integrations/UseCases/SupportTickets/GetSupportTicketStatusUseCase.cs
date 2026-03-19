namespace backend.Modules.Integrations.UseCases.SupportTickets;

public sealed class GetSupportTicketStatusUseCase(
    ISupportTicketExportRepository supportTicketExportRepository) : IGetSupportTicketStatusUseCase
{
    public async Task<SupportTicketStatusResult> ExecuteAsync(
        GetSupportTicketStatusQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var supportTicketExport = await supportTicketExportRepository.GetByTicketIdAsync(query.TicketId, cancellationToken);
        if (supportTicketExport is null)
        {
            throw new SupportTicketStatusNotFoundException(query.TicketId);
        }

        if (!query.ActorIsAdmin && supportTicketExport.ReportedByUserId != query.ActorUserId)
        {
            throw new SupportTicketStatusAccessDeniedException(query.TicketId, query.ActorUserId);
        }

        return new SupportTicketStatusResult(
            supportTicketExport.TicketId,
            supportTicketExport.Provider,
            supportTicketExport.Status,
            supportTicketExport.UploadedFileRef,
            supportTicketExport.ErrorMessage,
            supportTicketExport.CreatedAtUtc,
            supportTicketExport.UploadedAtUtc);
    }
}
