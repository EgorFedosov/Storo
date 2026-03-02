namespace backend.Modules.Concurrency.UseCases.Versioning;

public sealed record VersionedCommand(IfMatchToken IfMatchToken);
