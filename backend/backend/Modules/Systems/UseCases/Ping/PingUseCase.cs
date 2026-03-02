using backend.Infrastructure.Time;

namespace backend.Modules.Systems.UseCases.Ping;

public sealed class PingUseCase(IClock clock) : IPingUseCase
{
    public Task<PingResult> ExecuteAsync(PingQuery query, CancellationToken cancellationToken)
    {
        var result = new PingResult("pong", clock.UtcNow);
        return Task.FromResult(result);
    }
}
