using backend.Infrastructure.Persistence;
using backend.Modules.Inventories.Domain;
using backend.Modules.Items.Domain;
using backend.Modules.Search.UseCases.Abstractions;
using backend.Modules.Search.UseCases.SearchInventories;
using backend.Modules.Search.UseCases.SearchItems;
using backend.Modules.Search.UseCases.Shared;
using Microsoft.EntityFrameworkCore;
using NpgsqlTypes;

namespace backend.Modules.Search.Infrastructure.Persistence;

public sealed class EfCoreSearchReadModel(AppDbContext dbContext) : ISearchReadModel
{
    private const string SearchConfig = "simple";

    public async Task<SearchInventoriesResult> SearchInventoriesAsync(
        SearchInventoriesQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var source = dbContext.Inventories.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Tag))
        {
            var normalizedTag = query.Tag.Trim().ToLowerInvariant();
            source = source.Where(inventory =>
                inventory.InventoryTags.Any(inventoryTag => inventoryTag.Tag.NormalizedName == normalizedTag));
        }

        var hasQuery = !string.IsNullOrWhiteSpace(query.Query);
        NpgsqlTsQuery? tsQuery = null;

        if (hasQuery)
        {
            var searchQuery = query.Query!.Trim();
            tsQuery = EF.Functions.WebSearchToTsQuery(SearchConfig, searchQuery);

            source = source.Where(inventory =>
                EF.Property<NpgsqlTsVector>(inventory, "search_vector").Matches(tsQuery)
                || EF.Functions.ToTsVector(SearchConfig, inventory.Category.Name).Matches(tsQuery)
                || inventory.InventoryTags.Any(inventoryTag =>
                    EF.Property<NpgsqlTsVector>(inventoryTag.Tag, "search_vector").Matches(tsQuery)));
        }

        var totalCount = await source.CountAsync(cancellationToken);
        var sortedQuery = ApplyInventorySort(
            source,
            query.SortField,
            query.SortDirection,
            tsQuery,
            hasQuery);

        var skip = (query.Page - 1) * query.PageSize;
        var rows = await sortedQuery
            .Skip(skip)
            .Take(query.PageSize)
            .Select(inventory => new InventoryRowProjection(
                inventory.Id,
                inventory.Title,
                inventory.DescriptionMarkdown,
                inventory.CategoryId,
                inventory.Category.Name,
                inventory.CreatorId,
                inventory.Creator.UserName,
                inventory.Creator.DisplayName,
                inventory.ImageUrl,
                inventory.IsPublic,
                inventory.Statistics == null ? 0 : inventory.Statistics.ItemsCount,
                inventory.CreatedAt,
                inventory.UpdatedAt))
            .ToArrayAsync(cancellationToken);

        var inventoryIds = rows.Select(static row => row.Id).ToArray();
        var tagsByInventoryId = await LoadInventoryTagsAsync(inventoryIds, cancellationToken);

        var items = rows
            .Select(row =>
            {
                tagsByInventoryId.TryGetValue(row.Id, out var tags);

                return new SearchInventorySummaryResult(
                    row.Id,
                    row.Title,
                    row.DescriptionMarkdown,
                    new SearchInventoryCategoryResult(row.CategoryId, row.CategoryName),
                    new SearchInventoryCreatorResult(row.CreatorId, row.CreatorUserName, row.CreatorDisplayName),
                    tags ?? [],
                    row.ImageUrl,
                    row.IsPublic,
                    row.ItemsCount,
                    row.CreatedAt,
                    row.UpdatedAt);
            })
            .ToArray();

        return new SearchInventoriesResult(
            items,
            query.Page,
            query.PageSize,
            totalCount,
            new SearchInventoriesSortResult(query.SortField, query.SortDirection));
    }

    public async Task<SearchItemsResult> SearchItemsAsync(
        SearchItemsQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var searchQuery = query.Query.Trim();
        var tsQuery = EF.Functions.WebSearchToTsQuery(SearchConfig, searchQuery);

        var source = dbContext.Items
            .AsNoTracking()
            .Where(item =>
                EF.Functions.ToTsVector(SearchConfig, item.CustomId).Matches(tsQuery)
                || EF.Functions.ToTsVector(SearchConfig, item.Inventory.Title).Matches(tsQuery)
                || item.CustomFieldValues.Any(value =>
                    value.CustomField.IsEnabled
                    && EF.Property<NpgsqlTsVector>(value, "search_vector").Matches(tsQuery)));

        var totalCount = await source.CountAsync(cancellationToken);
        var sortedQuery = ApplyItemsSort(source, query.SortField, query.SortDirection, tsQuery);
        var skip = (query.Page - 1) * query.PageSize;

        var rows = await sortedQuery
            .Skip(skip)
            .Take(query.PageSize)
            .Select(item => new ItemRowProjection(
                item.Id,
                item.CustomId,
                item.InventoryId,
                item.Inventory.Title,
                item.CreatedAt,
                item.UpdatedAt))
            .ToArrayAsync(cancellationToken);

        var items = rows
            .Select(row => new SearchItemSummaryResult(
                row.Id,
                row.CustomId,
                new SearchItemInventoryResult(row.InventoryId, row.InventoryTitle),
                row.CreatedAt,
                row.UpdatedAt))
            .ToArray();

        return new SearchItemsResult(
            items,
            query.Page,
            query.PageSize,
            totalCount,
            new SearchItemsSortResult(query.SortField, query.SortDirection));
    }

    private async Task<Dictionary<long, IReadOnlyList<SearchInventoryTagResult>>> LoadInventoryTagsAsync(
        IReadOnlyCollection<long> inventoryIds,
        CancellationToken cancellationToken)
    {
        if (inventoryIds.Count == 0)
        {
            return [];
        }

        var tagRows = await dbContext.InventoryTags
            .AsNoTracking()
            .Where(inventoryTag => inventoryIds.Contains(inventoryTag.InventoryId))
            .OrderBy(inventoryTag => inventoryTag.InventoryId)
            .ThenBy(inventoryTag => inventoryTag.Tag.Name)
            .Select(inventoryTag => new InventoryTagProjection(
                inventoryTag.InventoryId,
                inventoryTag.TagId,
                inventoryTag.Tag.Name))
            .ToArrayAsync(cancellationToken);

        return tagRows
            .GroupBy(static row => row.InventoryId)
            .ToDictionary(
                static group => group.Key,
                static group => (IReadOnlyList<SearchInventoryTagResult>)group
                    .Select(tag => new SearchInventoryTagResult(tag.TagId, tag.Name))
                    .ToArray());
    }

    private static IQueryable<Inventory> ApplyInventorySort(
        IQueryable<Inventory> source,
        SearchInventoriesSortField sortField,
        SearchSortDirection sortDirection,
        NpgsqlTsQuery? tsQuery,
        bool hasQuery)
    {
        if (sortField == SearchInventoriesSortField.Relevance && hasQuery && tsQuery is not null)
        {
            return sortDirection == SearchSortDirection.Asc
                ? source
                    .OrderBy(inventory =>
                        EF.Property<NpgsqlTsVector>(inventory, "search_vector").Rank(tsQuery) * 2f
                        + EF.Functions.ToTsVector(SearchConfig, inventory.Category.Name).Rank(tsQuery)
                        + inventory.InventoryTags
                            .Select(inventoryTag => EF.Property<NpgsqlTsVector>(inventoryTag.Tag, "search_vector").Rank(tsQuery))
                            .DefaultIfEmpty(0f)
                            .Max())
                    .ThenBy(inventory => inventory.UpdatedAt)
                    .ThenBy(inventory => inventory.Id)
                : source
                    .OrderByDescending(inventory =>
                        EF.Property<NpgsqlTsVector>(inventory, "search_vector").Rank(tsQuery) * 2f
                        + EF.Functions.ToTsVector(SearchConfig, inventory.Category.Name).Rank(tsQuery)
                        + inventory.InventoryTags
                            .Select(inventoryTag => EF.Property<NpgsqlTsVector>(inventoryTag.Tag, "search_vector").Rank(tsQuery))
                            .DefaultIfEmpty(0f)
                            .Max())
                    .ThenByDescending(inventory => inventory.UpdatedAt)
                    .ThenBy(inventory => inventory.Id);
        }

        return (sortField, sortDirection) switch
        {
            (SearchInventoriesSortField.CreatedAt, SearchSortDirection.Asc) => source
                .OrderBy(inventory => inventory.CreatedAt)
                .ThenBy(inventory => inventory.Id),
            (SearchInventoriesSortField.CreatedAt, SearchSortDirection.Desc) => source
                .OrderByDescending(inventory => inventory.CreatedAt)
                .ThenBy(inventory => inventory.Id),
            (SearchInventoriesSortField.UpdatedAt, SearchSortDirection.Asc) => source
                .OrderBy(inventory => inventory.UpdatedAt)
                .ThenBy(inventory => inventory.Id),
            (SearchInventoriesSortField.UpdatedAt, SearchSortDirection.Desc) => source
                .OrderByDescending(inventory => inventory.UpdatedAt)
                .ThenBy(inventory => inventory.Id),
            (SearchInventoriesSortField.Title, SearchSortDirection.Asc) => source
                .OrderBy(inventory => inventory.Title)
                .ThenBy(inventory => inventory.Id),
            (SearchInventoriesSortField.Title, SearchSortDirection.Desc) => source
                .OrderByDescending(inventory => inventory.Title)
                .ThenBy(inventory => inventory.Id),
            _ => source
                .OrderByDescending(inventory => inventory.UpdatedAt)
                .ThenBy(inventory => inventory.Id)
        };
    }

    private static IQueryable<Item> ApplyItemsSort(
        IQueryable<Item> source,
        SearchItemsSortField sortField,
        SearchSortDirection sortDirection,
        NpgsqlTsQuery tsQuery)
    {
        if (sortField == SearchItemsSortField.Relevance)
        {
            return sortDirection == SearchSortDirection.Asc
                ? source
                    .OrderBy(item =>
                        EF.Functions.ToTsVector(SearchConfig, item.Inventory.Title).Rank(tsQuery) * 2f
                        + EF.Functions.ToTsVector(SearchConfig, item.CustomId).Rank(tsQuery)
                        + item.CustomFieldValues
                            .Where(value => value.CustomField.IsEnabled)
                            .Select(value => EF.Property<NpgsqlTsVector>(value, "search_vector").Rank(tsQuery))
                            .DefaultIfEmpty(0f)
                            .Max())
                    .ThenBy(item => item.UpdatedAt)
                    .ThenBy(item => item.Id)
                : source
                    .OrderByDescending(item =>
                        EF.Functions.ToTsVector(SearchConfig, item.Inventory.Title).Rank(tsQuery) * 2f
                        + EF.Functions.ToTsVector(SearchConfig, item.CustomId).Rank(tsQuery)
                        + item.CustomFieldValues
                            .Where(value => value.CustomField.IsEnabled)
                            .Select(value => EF.Property<NpgsqlTsVector>(value, "search_vector").Rank(tsQuery))
                            .DefaultIfEmpty(0f)
                            .Max())
                    .ThenByDescending(item => item.UpdatedAt)
                    .ThenBy(item => item.Id);
        }

        return (sortField, sortDirection) switch
        {
            (SearchItemsSortField.CreatedAt, SearchSortDirection.Asc) => source
                .OrderBy(item => item.CreatedAt)
                .ThenBy(item => item.Id),
            (SearchItemsSortField.CreatedAt, SearchSortDirection.Desc) => source
                .OrderByDescending(item => item.CreatedAt)
                .ThenBy(item => item.Id),
            (SearchItemsSortField.UpdatedAt, SearchSortDirection.Asc) => source
                .OrderBy(item => item.UpdatedAt)
                .ThenBy(item => item.Id),
            (SearchItemsSortField.UpdatedAt, SearchSortDirection.Desc) => source
                .OrderByDescending(item => item.UpdatedAt)
                .ThenBy(item => item.Id),
            (SearchItemsSortField.CustomId, SearchSortDirection.Asc) => source
                .OrderBy(item => item.CustomId)
                .ThenBy(item => item.Id),
            (SearchItemsSortField.CustomId, SearchSortDirection.Desc) => source
                .OrderByDescending(item => item.CustomId)
                .ThenBy(item => item.Id),
            _ => source
                .OrderByDescending(item => item.UpdatedAt)
                .ThenBy(item => item.Id)
        };
    }

    private sealed record InventoryRowProjection(
        long Id,
        string Title,
        string DescriptionMarkdown,
        int CategoryId,
        string CategoryName,
        long CreatorId,
        string CreatorUserName,
        string CreatorDisplayName,
        string? ImageUrl,
        bool IsPublic,
        int ItemsCount,
        DateTime CreatedAt,
        DateTime UpdatedAt);

    private sealed record InventoryTagProjection(
        long InventoryId,
        long TagId,
        string Name);

    private sealed record ItemRowProjection(
        long Id,
        string CustomId,
        long InventoryId,
        string InventoryTitle,
        DateTime CreatedAt,
        DateTime UpdatedAt);
}
