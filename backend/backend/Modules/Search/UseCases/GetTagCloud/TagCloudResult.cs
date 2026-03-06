namespace backend.Modules.Search.UseCases.GetTagCloud;

public sealed record TagCloudEntryResult(long Id, string Name, int Count);

public sealed record TagCloudResult(IReadOnlyList<TagCloudEntryResult> Items);
