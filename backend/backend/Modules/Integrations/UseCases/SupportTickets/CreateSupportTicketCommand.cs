namespace backend.Modules.Integrations.UseCases.SupportTickets;

public sealed record CreateSupportTicketCommand(
    string Summary,
    string Priority,
    string PageLink,
    long? InventoryId,
    string Provider,
    long ActorUserId,
    string ActorEmail,
    string ActorDisplayName,
    bool ActorIsAdmin);
