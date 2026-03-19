namespace backend.Modules.Integrations.UseCases.SupportTickets;

public interface IGetSupportTicketStatusUseCase
{
    Task<SupportTicketStatusResult> ExecuteAsync(
        GetSupportTicketStatusQuery query,
        CancellationToken cancellationToken);
}
