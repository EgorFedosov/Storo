using backend.Infrastructure.Persistence;
using backend.Modules.Inventories.UseCases.GetInventoryEditor;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Inventories.Infrastructure.Persistence;

public sealed class EfCoreInventoryEditorReadModel(AppDbContext dbContext) : IInventoryEditorReadModel
{
    public async Task<InventoryEditorReadModel?> GetAsync(long inventoryId, CancellationToken cancellationToken)
    {
        var inventory = await dbContext.Inventories
            .AsNoTracking()
            .AsSplitQuery()
            .Include(entity => entity.Category)
            .Include(entity => entity.InventoryTags)
            .ThenInclude(inventoryTag => inventoryTag.Tag)
            .Include(entity => entity.AccessList)
            .ThenInclude(access => access.User)
            .Include(entity => entity.CustomFields)
            .Include(entity => entity.CustomIdTemplate)
            .ThenInclude(template => template.Parts)
            .Include(entity => entity.CustomIdSequenceState)
            .SingleOrDefaultAsync(entity => entity.Id == inventoryId, cancellationToken);

        if (inventory is null)
        {
            return null;
        }

        var tags = inventory.InventoryTags
            .OrderBy(inventoryTag => inventoryTag.Tag.Name, StringComparer.OrdinalIgnoreCase)
            .ThenBy(inventoryTag => inventoryTag.TagId)
            .Select(inventoryTag => new InventoryEditorTagReadModel(
                inventoryTag.TagId,
                inventoryTag.Tag.Name))
            .ToArray();

        var writers = inventory.AccessList
            .OrderBy(access => access.User.UserName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(access => access.UserId)
            .Select(access => new InventoryEditorWriterReadModel(
                access.UserId,
                access.User.UserName,
                access.User.DisplayName,
                access.User.Email,
                access.User.IsBlocked))
            .ToArray();

        var customFields = inventory.CustomFields
            .Where(customField => customField.IsEnabled)
            .OrderBy(customField => customField.SortOrder)
            .ThenBy(customField => customField.Id)
            .Select(customField => new InventoryEditorCustomFieldReadModel(
                customField.Id,
                customField.FieldType,
                customField.Title,
                customField.Description,
                customField.ShowInTable))
            .ToArray();

        var customIdTemplate = inventory.CustomIdTemplate is null
            ? null
            : new InventoryEditorCustomIdTemplateReadModel(
                inventory.CustomIdTemplate.IsEnabled,
                inventory.CustomIdTemplate.ValidationRegex,
                inventory.CustomIdTemplate.Parts
                    .OrderBy(part => part.SortOrder)
                    .ThenBy(part => part.Id)
                    .Select(part => new InventoryEditorCustomIdTemplatePartReadModel(
                        part.Id,
                        part.PartType,
                        part.FixedText,
                        part.FormatPattern))
                    .ToArray());

        return new InventoryEditorReadModel(
            inventory.Id,
            inventory.Version,
            inventory.CreatorId,
            inventory.Title,
            inventory.DescriptionMarkdown,
            inventory.CategoryId,
            inventory.Category.Name,
            inventory.ImageUrl,
            inventory.IsPublic,
            tags,
            writers,
            customFields,
            customIdTemplate,
            inventory.CustomIdSequenceState?.LastValue);
    }
}
