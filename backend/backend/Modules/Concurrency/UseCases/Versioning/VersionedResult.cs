namespace backend.Modules.Concurrency.UseCases.Versioning;

public sealed record VersionedResult(int Version, string ETag);
