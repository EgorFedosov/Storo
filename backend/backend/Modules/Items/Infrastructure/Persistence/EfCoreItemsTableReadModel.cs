using backend.Infrastructure.Persistence;
using backend.Modules.Inventories.Domain;
using backend.Modules.Items.Domain;
using backend.Modules.Items.UseCases.ListInventoryItems;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Items.Infrastructure.Persistence;

public sealed class EfCoreItemsTableReadModel(AppDbContext dbContext) : IItemsTableReadModel
{
    public async Task<ItemsTableResult?> ListAsync(
        ListInventoryItemsReadModelQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var inventory = await dbContext.Inventories
            .AsNoTracking()
            .Where(i => i.Id == query.InventoryId)
            .Select(i => new InventoryProjection(i.Id, i.Version))
            .SingleOrDefaultAsync(cancellationToken);

        if (inventory is null)
        {
            return null;
        }

        var customColumns = await dbContext.CustomFields
            .AsNoTracking()
            .Where(field => field.InventoryId == query.InventoryId && field.IsEnabled && field.ShowInTable)
            .OrderBy(field => field.SortOrder)
            .ThenBy(field => field.Id)
            .Select(field => new CustomColumnProjection(field.Id, field.Title, field.FieldType))
            .ToArrayAsync(cancellationToken);

        var columns = BuildColumns(customColumns);

        var itemsQuery = dbContext.Items
            .AsNoTracking()
            .Where(item => item.InventoryId == query.InventoryId);

        var totalCount = await itemsQuery.CountAsync(cancellationToken);
        var sortedQuery = ApplySort(itemsQuery, query.SortField, query.SortDirection);
        var skip = (query.Page - 1) * query.PageSize;

        var hasViewer = query.ViewerUserId.HasValue;
        var viewerUserId = query.ViewerUserId.GetValueOrDefault();

        var rowProjections = await sortedQuery
            .Skip(skip)
            .Take(query.PageSize)
            .Select(item => new RowProjection(
                item.Id,
                item.Version,
                item.CustomId,
                item.CreatedAt,
                item.UpdatedAt,
                item.Likes.Count(),
                hasViewer && item.Likes.Any(like => like.UserId == viewerUserId)))
            .ToArrayAsync(cancellationToken);

        var itemIds = rowProjections.Select(row => row.ItemId).ToArray();
        var fieldIds = customColumns.Select(column => column.FieldId).ToArray();
        var valueLookup = await LoadValueLookupAsync(itemIds, fieldIds, cancellationToken);

        var rows = rowProjections
            .Select(row => MapRow(row, customColumns, valueLookup))
            .ToArray();

        return new ItemsTableResult(
            inventory.InventoryId,
            inventory.Version,
            columns,
            rows,
            query.Page,
            query.PageSize,
            totalCount);
    }

    private static IReadOnlyList<ItemsTableColumnResult> BuildColumns(
        IReadOnlyList<CustomColumnProjection> customColumns)
    {
        var columns = new List<ItemsTableColumnResult>(3 + customColumns.Count)
        {
            new("customId", "ID", ItemsTableColumnKind.Fixed, null, null),
            new("createdAt", "Created", ItemsTableColumnKind.Fixed, null, null),
            new("updatedAt", "Updated", ItemsTableColumnKind.Fixed, null, null)
        };

        columns.AddRange(customColumns.Select(column =>
            new ItemsTableColumnResult(
                $"field:{column.FieldId}",
                column.Title,
                ItemsTableColumnKind.Custom,
                column.FieldId,
                column.FieldType)));

        return columns;
    }

    private IQueryable<Item> ApplySort(
        IQueryable<Item> source,
        ItemsTableSortField sortField,
        ItemsTableSortDirection sortDirection)
    {
        return sortField.Kind switch
        {
            ItemsTableSortFieldKind.CustomId => sortDirection switch
            {
                ItemsTableSortDirection.Asc => source
                    .OrderBy(item => item.CustomId)
                    .ThenBy(item => item.Id),
                _ => source
                    .OrderByDescending(item => item.CustomId)
                    .ThenBy(item => item.Id)
            },
            ItemsTableSortFieldKind.CreatedAt => sortDirection switch
            {
                ItemsTableSortDirection.Asc => source
                    .OrderBy(item => item.CreatedAt)
                    .ThenBy(item => item.Id),
                _ => source
                    .OrderByDescending(item => item.CreatedAt)
                    .ThenBy(item => item.Id)
            },
            ItemsTableSortFieldKind.UpdatedAt => sortDirection switch
            {
                ItemsTableSortDirection.Asc => source
                    .OrderBy(item => item.UpdatedAt)
                    .ThenBy(item => item.Id),
                _ => source
                    .OrderByDescending(item => item.UpdatedAt)
                    .ThenBy(item => item.Id)
            },
            ItemsTableSortFieldKind.CustomField when sortField.FieldId.HasValue => ApplyCustomFieldSort(
                source,
                sortField.FieldId.Value,
                sortDirection),
            _ => source
                .OrderByDescending(item => item.UpdatedAt)
                .ThenBy(item => item.Id)
        };
    }

    private IQueryable<Item> ApplyCustomFieldSort(
        IQueryable<Item> source,
        long customFieldId,
        ItemsTableSortDirection sortDirection)
    {
        var valueQuery = dbContext.ItemCustomFieldValues
            .AsNoTracking()
            .Where(value => value.CustomFieldId == customFieldId);

        var projections =
            from item in source
            join value in valueQuery on item.Id equals value.ItemId into valueGroup
            from value in valueGroup.DefaultIfEmpty()
            select new CustomSortProjection(
                item,
                value == null
                    ? 3
                    : value.NumberValue.HasValue
                        ? 0
                        : value.BoolValue.HasValue
                            ? 1
                            : 2,
                value == null ? null : value.NumberValue,
                value == null ? null : value.BoolValue,
                value == null ? null : value.StringValue ?? value.TextValue ?? value.LinkValue);

        return sortDirection switch
        {
            ItemsTableSortDirection.Asc => projections
                .OrderBy(projection => projection.SortTypeRank)
                .ThenBy(projection => projection.NumberValue)
                .ThenBy(projection => projection.BoolValue)
                .ThenBy(projection => projection.TextValue)
                .ThenBy(projection => projection.Item.Id)
                .Select(projection => projection.Item),
            _ => projections
                .OrderByDescending(projection => projection.SortTypeRank)
                .ThenByDescending(projection => projection.NumberValue)
                .ThenByDescending(projection => projection.BoolValue)
                .ThenByDescending(projection => projection.TextValue)
                .ThenBy(projection => projection.Item.Id)
                .Select(projection => projection.Item)
        };
    }

    private async Task<Dictionary<(long ItemId, long FieldId), object?>> LoadValueLookupAsync(
        IReadOnlyCollection<long> itemIds,
        IReadOnlyCollection<long> fieldIds,
        CancellationToken cancellationToken)
    {
        if (itemIds.Count == 0 || fieldIds.Count == 0)
        {
            return new Dictionary<(long ItemId, long FieldId), object?>();
        }

        var values = await dbContext.ItemCustomFieldValues
            .AsNoTracking()
            .Where(value => itemIds.Contains(value.ItemId) && fieldIds.Contains(value.CustomFieldId))
            .Select(value => new ValueProjection(
                value.ItemId,
                value.CustomFieldId,
                value.StringValue,
                value.TextValue,
                value.NumberValue,
                value.LinkValue,
                value.BoolValue))
            .ToArrayAsync(cancellationToken);

        return values.ToDictionary(
            value => (value.ItemId, value.FieldId),
            value => ToCellValue(value));
    }

    private static ItemsTableRowResult MapRow(
        RowProjection row,
        IReadOnlyList<CustomColumnProjection> customColumns,
        IReadOnlyDictionary<(long ItemId, long FieldId), object?> valueLookup)
    {
        var cells = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["customId"] = row.CustomId,
            ["createdAt"] = row.CreatedAt,
            ["updatedAt"] = row.UpdatedAt
        };

        foreach (var customColumn in customColumns)
        {
            var key = $"field:{customColumn.FieldId}";
            cells[key] = valueLookup.TryGetValue((row.ItemId, customColumn.FieldId), out var value)
                ? value
                : null;
        }

        return new ItemsTableRowResult(
            row.ItemId,
            row.Version,
            cells,
            new ItemLikeStateResult(row.LikeCount, row.LikedByCurrentUser));
    }

    private static object? ToCellValue(ValueProjection value)
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

    private sealed record InventoryProjection(long InventoryId, int Version);

    private sealed record CustomColumnProjection(
        long FieldId,
        string Title,
        CustomFieldType FieldType);

    private sealed record RowProjection(
        long ItemId,
        int Version,
        string CustomId,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        int LikeCount,
        bool LikedByCurrentUser);

    private sealed record CustomSortProjection(
        Item Item,
        int SortTypeRank,
        decimal? NumberValue,
        bool? BoolValue,
        string? TextValue);

    private sealed record ValueProjection(
        long ItemId,
        long FieldId,
        string? StringValue,
        string? TextValue,
        decimal? NumberValue,
        string? LinkValue,
        bool? BoolValue);
}
