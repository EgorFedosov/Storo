namespace backend.Modules.Systems.UseCases.Ping;

public sealed record PingResult(
    string Message,
    DateTimeOffset UtcNow);
