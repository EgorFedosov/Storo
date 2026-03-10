using backend.Infrastructure.Persistence;
using backend.Modules.Search.UseCases.Abstractions;
using backend.Modules.Search.UseCases.AutocompleteTags;
using backend.Modules.Search.UseCases.GetTagCloud;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Search.Infrastructure.Persistence;

public sealed class EfCoreTagReadModel(AppDbContext dbContext) : ITagReadModel
{
    public async Task<IReadOnlyList<TagAutocompleteResult>> AutocompleteAsync(
        AutocompleteTagsQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var normalizedPrefix = query.Prefix.Trim().ToLowerInvariant();

        return await dbContext.Tags
            .AsNoTracking()
            .Where(tag => tag.NormalizedName.StartsWith(normalizedPrefix))
            .OrderBy(tag => tag.Name)
            .ThenBy(tag => tag.Id)
            .Take(query.Limit)
            .Select(tag => new TagAutocompleteResult(tag.Id, tag.Name))
            .ToArrayAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<TagCloudEntryResult>> GetTagCloudAsync(
        GetTagCloudQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        return await dbContext.Tags
            .AsNoTracking()
            .Where(tag => tag.InventoryTags.Any())
            .Select(tag => new
            {
                tag.Id,
                tag.Name,
                Count = tag.InventoryTags.Count()
            })
            .OrderByDescending(tag => tag.Count)
            .ThenBy(tag => tag.Name)
            .ThenBy(tag => tag.Id)
            .Take(query.Limit)
            .Select(tag => new TagCloudEntryResult(
                tag.Id,
                tag.Name,
                tag.Count))
            .ToArrayAsync(cancellationToken);
    }
}