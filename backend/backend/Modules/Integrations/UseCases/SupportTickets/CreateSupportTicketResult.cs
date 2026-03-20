namespace backend.Modules.Integrations.UseCases.SupportTickets;

public sealed record CreateSupportTicketResult(
    string TicketId,
    string Provider,
    string Status,
    string UploadedFileRef,
    DateTime CreatedAtUtc);
