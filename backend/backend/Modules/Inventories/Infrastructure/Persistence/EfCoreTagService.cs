using backend.Infrastructure.Persistence;
using backend.Modules.Inventories.Domain;
using backend.Modules.Inventories.UseCases.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Inventories.Infrastructure.Persistence;

public sealed class EfCoreTagService(AppDbContext dbContext) : ITagService
{
    public async Task<IReadOnlyList<Tag>> ResolveTagsAsync(
        IReadOnlyCollection<string> tagNames,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(tagNames);
        cancellationToken.ThrowIfCancellationRequested();

        var normalizedInputs = Normalize(tagNames);
        if (normalizedInputs.Count == 0)
        {
            return Array.Empty<Tag>();
        }

        var normalizedNames = normalizedInputs
            .Select(input => input.NormalizedName)
            .ToArray();

        var existingTags = await dbContext.Tags
            .Where(tag => normalizedNames.Contains(tag.NormalizedName))
            .ToListAsync(cancellationToken);

        var tagsByNormalizedName = existingTags.ToDictionary(
            tag => tag.NormalizedName,
            tag => tag,
            StringComparer.Ordinal);

        var resolved = new List<Tag>(normalizedInputs.Count);

        foreach (var input in normalizedInputs)
        {
            if (!tagsByNormalizedName.TryGetValue(input.NormalizedName, out var tag))
            {
                tag = new Tag
                {
                    Name = input.Name,
                    NormalizedName = input.NormalizedName,
                    CreatedAt = DateTime.UtcNow
                };

                dbContext.Tags.Add(tag);
                tagsByNormalizedName[input.NormalizedName] = tag;
            }

            resolved.Add(tag);
        }

        return resolved;
    }

    private static List<NormalizedTagInput> Normalize(IReadOnlyCollection<string> tagNames)
    {
        var normalized = new List<NormalizedTagInput>(tagNames.Count);

        foreach (var tagName in tagNames)
        {
            if (string.IsNullOrWhiteSpace(tagName))
            {
                continue;
            }

            var trimmedName = tagName.Trim();
            var normalizedName = trimmedName.ToLowerInvariant();

            if (normalized.Any(existing =>
                    string.Equals(existing.NormalizedName, normalizedName, StringComparison.Ordinal)))
            {
                continue;
            }

            normalized.Add(new NormalizedTagInput(trimmedName, normalizedName));
        }

        return normalized;
    }

    private sealed record NormalizedTagInput(string Name, string NormalizedName);
}
