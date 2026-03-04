using System.Globalization;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;

namespace backend.Modules.Inventories.Api;

public sealed record InventoryDetailsResponse(
    string Id,
    int Version,
    InventoryHeaderResponse Header,
    InventoryCreatorResponse Creator,
    IReadOnlyList<InventoryTagResponse> Tags,
    InventorySummaryResponse Summary,
    InventoryPermissionsResponse Permissions)
{
    public static InventoryDetailsResponse FromResult(InventoryDetailsResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new InventoryDetailsResponse(
            result.Id.ToString(CultureInfo.InvariantCulture),
            result.Version,
            new InventoryHeaderResponse(
                result.Header.Title,
                result.Header.DescriptionMarkdown,
                new InventoryCategoryResponse(result.Header.Category.Id, result.Header.Category.Name),
                result.Header.ImageUrl,
                result.Header.IsPublic,
                result.Header.CreatedAt,
                result.Header.UpdatedAt),
            new InventoryCreatorResponse(
                result.Creator.Id.ToString(CultureInfo.InvariantCulture),
                result.Creator.UserName,
                result.Creator.DisplayName),
            result.Tags
                .Select(tag => new InventoryTagResponse(
                    tag.Id.ToString(CultureInfo.InvariantCulture),
                    tag.Name))
                .ToArray(),
            new InventorySummaryResponse(result.Summary.ItemsCount),
            new InventoryPermissionsResponse(
                result.Permissions.CanEditInventory,
                result.Permissions.CanManageAccess,
                result.Permissions.CanManageCustomFields,
                result.Permissions.CanManageCustomIdTemplate,
                result.Permissions.CanWriteItems,
                result.Permissions.CanComment,
                result.Permissions.CanLike));
    }
}

public sealed record InventoryHeaderResponse(
    string Title,
    string DescriptionMarkdown,
    InventoryCategoryResponse Category,
    string? ImageUrl,
    bool IsPublic,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record InventoryCategoryResponse(int Id, string Name);

public sealed record InventoryCreatorResponse(string Id, string UserName, string DisplayName);

public sealed record InventoryTagResponse(string Id, string Name);

public sealed record InventorySummaryResponse(int ItemsCount);

public sealed record InventoryPermissionsResponse(
    bool CanEditInventory,
    bool CanManageAccess,
    bool CanManageCustomFields,
    bool CanManageCustomIdTemplate,
    bool CanWriteItems,
    bool CanComment,
    bool CanLike);
