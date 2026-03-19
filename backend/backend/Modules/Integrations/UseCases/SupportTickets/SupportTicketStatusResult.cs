namespace backend.Modules.Integrations.UseCases.SupportTickets;

public sealed record SupportTicketStatusResult(
    string TicketId,
    string Provider,
    string Status,
    string? UploadedFileRef,
    string? ErrorMessage,
    DateTime CreatedAtUtc,
    DateTime? UploadedAtUtc);
