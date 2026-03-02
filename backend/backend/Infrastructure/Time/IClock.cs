namespace backend.Infrastructure.Time;

public interface IClock
{
    DateTimeOffset UtcNow { get; }
}
