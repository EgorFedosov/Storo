namespace backend.Modules.Integrations.UseCases.SupportTickets;

public sealed class SupportTicketInventoryAccessDeniedException(long inventoryId, long actorUserId)
    : Exception($"User '{actorUserId}' has no access to inventory '{inventoryId}'.")
{
    public long InventoryId { get; } = inventoryId;
    public long ActorUserId { get; } = actorUserId;
}

public sealed class SupportTicketDropboxUpstreamException(string message, Exception innerException)
    : Exception(message, innerException);
