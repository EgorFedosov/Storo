using backend.Modules.Inventories.Domain;

namespace backend.Modules.Inventories.UseCases.Abstractions;

public interface ITagService
{
    Task<IReadOnlyList<Tag>> ResolveTagsAsync(
        IReadOnlyCollection<string> tagNames,
        CancellationToken cancellationToken);
}
