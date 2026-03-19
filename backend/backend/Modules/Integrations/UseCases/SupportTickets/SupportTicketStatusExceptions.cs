namespace backend.Modules.Integrations.UseCases.SupportTickets;

public sealed class SupportTicketStatusNotFoundException(string ticketId)
    : Exception($"Support ticket '{ticketId}' was not found.")
{
    public string TicketId { get; } = ticketId;
}

public sealed class SupportTicketStatusAccessDeniedException(string ticketId, long actorUserId)
    : Exception($"User '{actorUserId}' has no access to support ticket '{ticketId}'.")
{
    public string TicketId { get; } = ticketId;
    public long ActorUserId { get; } = actorUserId;
}
