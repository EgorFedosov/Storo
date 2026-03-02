using backend.Modules.Systems.UseCases.Ping;

namespace backend.Modules.Systems.Api;

public sealed record PingResponse(
    string Message,
    DateTimeOffset UtcNow)
{
    public static PingResponse FromResult(PingResult result) =>
        new(result.Message, result.UtcNow);
}
