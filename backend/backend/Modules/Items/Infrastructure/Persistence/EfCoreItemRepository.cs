using backend.Infrastructure.Persistence;
using backend.Modules.Inventories.Domain;
using backend.Modules.Items.Domain;
using backend.Modules.Items.UseCases.CreateItem;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Items.Infrastructure.Persistence;

public sealed class EfCoreItemRepository(AppDbContext dbContext) : IItemRepository
{
    public Task<Inventory?> GetInventoryForCreateAsync(
        long inventoryId,
        CancellationToken cancellationToken)
    {
        return dbContext.Inventories
            .AsSplitQuery()
            .Include(inventory => inventory.AccessList)
            .Include(inventory => inventory.CustomFields)
            .Include(inventory => inventory.CustomIdTemplate!)
            .ThenInclude(template => template.Parts)
            .Include(inventory => inventory.CustomIdSequenceState)
            .SingleOrDefaultAsync(inventory => inventory.Id == inventoryId, cancellationToken);
    }

    public Task AddAsync(Item item, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(item);
        return dbContext.Items.AddAsync(item, cancellationToken).AsTask();
    }

    public async Task<ItemDetailsAggregate?> GetDetailsAsync(
        long itemId,
        long? viewerUserId,
        CancellationToken cancellationToken)
    {
        var hasViewer = viewerUserId.HasValue;
        var viewerId = viewerUserId.GetValueOrDefault();

        var root = await dbContext.Items
            .AsNoTracking()
            .Where(item => item.Id == itemId)
            .Select(item => new ItemRootProjection(
                item.Id,
                item.InventoryId,
                item.Inventory.Title,
                item.Inventory.CreatorId,
                item.Inventory.IsPublic,
                hasViewer && item.Inventory.AccessList.Any(access => access.UserId == viewerId),
                item.CustomId,
                item.Version,
                item.CreatedAt,
                item.UpdatedAt,
                item.CreatedByUserId,
                item.CreatedByUser == null ? null : item.CreatedByUser.UserName,
                item.CreatedByUser == null ? null : item.CreatedByUser.DisplayName,
                item.UpdatedByUserId,
                item.UpdatedByUser == null ? null : item.UpdatedByUser.UserName,
                item.UpdatedByUser == null ? null : item.UpdatedByUser.DisplayName,
                item.Likes.Count(),
                hasViewer && item.Likes.Any(like => like.UserId == viewerId)))
            .SingleOrDefaultAsync(cancellationToken);

        if (root is null)
        {
            return null;
        }

        var activeFields = await dbContext.CustomFields
            .AsNoTracking()
            .Where(field => field.InventoryId == root.InventoryId && field.IsEnabled)
            .OrderBy(field => field.SortOrder)
            .ThenBy(field => field.Id)
            .Select(field => new ActiveFieldProjection(
                field.Id,
                field.FieldType,
                field.Title,
                field.Description))
            .ToArrayAsync(cancellationToken);

        var fieldIds = activeFields.Select(field => field.FieldId).ToArray();
        var valueLookup = await LoadFieldValueLookupAsync(itemId, fieldIds, cancellationToken);

        var fields = activeFields
            .Select(field => new ItemDetailsFieldAggregate(
                field.FieldId,
                field.FieldType,
                field.Title,
                field.Description,
                valueLookup.TryGetValue(field.FieldId, out var value) ? ToApiValue(value) : null))
            .ToArray();

        var createdBy = ToUserSummary(root.CreatedByUserId, root.CreatedByUserName, root.CreatedByDisplayName);
        var updatedBy = ToUserSummary(root.UpdatedByUserId, root.UpdatedByUserName, root.UpdatedByDisplayName);

        return new ItemDetailsAggregate(
            root.ItemId,
            root.InventoryId,
            root.InventoryTitle,
            root.InventoryCreatorId,
            root.InventoryIsPublic,
            root.ViewerHasWriteAccess,
            root.CustomId,
            root.Version,
            root.CreatedAt,
            root.UpdatedAt,
            createdBy,
            updatedBy,
            root.LikeCount,
            root.LikedByViewer,
            fields);
    }

    public Task<Item?> GetForUpdateAsync(
        long itemId,
        CancellationToken cancellationToken)
    {
        return dbContext.Items
            .AsSplitQuery()
            .Include(item => item.Inventory)
            .ThenInclude(inventory => inventory.AccessList)
            .Include(item => item.Inventory)
            .ThenInclude(inventory => inventory.CustomFields)
            .Include(item => item.Inventory)
            .ThenInclude(inventory => inventory.CustomIdTemplate!)
            .ThenInclude(template => template.Parts)
            .Include(item => item.CustomFieldValues)
            .SingleOrDefaultAsync(item => item.Id == itemId, cancellationToken);
    }

    public void Delete(Item item)
    {
        ArgumentNullException.ThrowIfNull(item);
        dbContext.Items.Remove(item);
    }

    public Task<ItemUserResult?> GetUserSummaryAsync(
        long userId,
        CancellationToken cancellationToken)
    {
        return dbContext.Users
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => new ItemUserResult(
                user.Id,
                user.UserName,
                user.DisplayName))
            .SingleOrDefaultAsync(cancellationToken);
    }

    private async Task<Dictionary<long, FieldValueProjection>> LoadFieldValueLookupAsync(
        long itemId,
        IReadOnlyCollection<long> fieldIds,
        CancellationToken cancellationToken)
    {
        if (fieldIds.Count == 0)
        {
            return new Dictionary<long, FieldValueProjection>();
        }

        var values = await dbContext.ItemCustomFieldValues
            .AsNoTracking()
            .Where(value => value.ItemId == itemId && fieldIds.Contains(value.CustomFieldId))
            .Select(value => new FieldValueProjection(
                value.CustomFieldId,
                value.StringValue,
                value.TextValue,
                value.NumberValue,
                value.LinkValue,
                value.BoolValue))
            .ToArrayAsync(cancellationToken);

        return values.ToDictionary(value => value.FieldId);
    }

    private static object? ToApiValue(FieldValueProjection value)
    {
        if (value.StringValue is not null)
        {
            return value.StringValue;
        }

        if (value.TextValue is not null)
        {
            return value.TextValue;
        }

        if (value.NumberValue.HasValue)
        {
            return value.NumberValue.Value;
        }

        if (value.LinkValue is not null)
        {
            return value.LinkValue;
        }

        if (value.BoolValue.HasValue)
        {
            return value.BoolValue.Value;
        }

        return null;
    }

    private static ItemUserResult? ToUserSummary(
        long? userId,
        string? userName,
        string? displayName)
    {
        if (!userId.HasValue
            || string.IsNullOrWhiteSpace(userName)
            || string.IsNullOrWhiteSpace(displayName))
        {
            return null;
        }

        return new ItemUserResult(userId.Value, userName, displayName);
    }

    private sealed record ItemRootProjection(
        long ItemId,
        long InventoryId,
        string InventoryTitle,
        long InventoryCreatorId,
        bool InventoryIsPublic,
        bool ViewerHasWriteAccess,
        string CustomId,
        int Version,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        long? CreatedByUserId,
        string? CreatedByUserName,
        string? CreatedByDisplayName,
        long? UpdatedByUserId,
        string? UpdatedByUserName,
        string? UpdatedByDisplayName,
        int LikeCount,
        bool LikedByViewer);

    private sealed record ActiveFieldProjection(
        long FieldId,
        CustomFieldType FieldType,
        string Title,
        string Description);

    private sealed record FieldValueProjection(
        long FieldId,
        string? StringValue,
        string? TextValue,
        decimal? NumberValue,
        string? LinkValue,
        bool? BoolValue);
}
