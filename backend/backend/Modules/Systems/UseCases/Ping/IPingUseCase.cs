namespace backend.Modules.Systems.UseCases.Ping;

public interface IPingUseCase
{
    Task<PingResult> ExecuteAsync(PingQuery query, CancellationToken cancellationToken);
}
