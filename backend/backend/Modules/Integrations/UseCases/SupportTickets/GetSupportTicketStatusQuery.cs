namespace backend.Modules.Integrations.UseCases.SupportTickets;

public sealed record GetSupportTicketStatusQuery(
    string TicketId,
    long ActorUserId,
    bool ActorIsAdmin);
