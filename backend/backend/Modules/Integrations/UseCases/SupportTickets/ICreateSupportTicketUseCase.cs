namespace backend.Modules.Integrations.UseCases.SupportTickets;

public interface ICreateSupportTicketUseCase
{
    Task<CreateSupportTicketResult> ExecuteAsync(
        CreateSupportTicketCommand command,
        CancellationToken cancellationToken);
}
