using System.Globalization;
using backend.Modules.Inventories.Domain;
using backend.Modules.Items.UseCases.CreateItem;

namespace backend.Modules.Items.Api;

public sealed record ItemDetailsResponse(
    string Id,
    ItemInventorySummaryResponse Inventory,
    string CustomId,
    int Version,
    ItemFixedFieldsResponse FixedFields,
    IReadOnlyList<ItemCustomFieldValueResponse> Fields,
    ItemLikeStateResponse Like,
    ItemPermissionsResponse Permissions)
{
    public static ItemDetailsResponse FromResult(ItemResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new ItemDetailsResponse(
            result.Id.ToString(CultureInfo.InvariantCulture),
            new ItemInventorySummaryResponse(
                result.Inventory.Id.ToString(CultureInfo.InvariantCulture),
                result.Inventory.Title),
            result.CustomId,
            result.Version,
            new ItemFixedFieldsResponse(
                result.FixedFields.CreatedAt,
                result.FixedFields.UpdatedAt,
                ToUserResponse(result.FixedFields.CreatedBy),
                ToUserResponse(result.FixedFields.UpdatedBy)),
            result.Fields.Select(field => new ItemCustomFieldValueResponse(
                    field.FieldId.ToString(CultureInfo.InvariantCulture),
                    ToApiFieldType(field.FieldType),
                    field.Title,
                    field.Description,
                    field.Value))
                .ToArray(),
            new ItemLikeStateResponse(result.Like.Count, result.Like.LikedByCurrentUser),
            new ItemPermissionsResponse(
                result.Permissions.CanEdit,
                result.Permissions.CanDelete,
                result.Permissions.CanLike));
    }

    private static ItemUserSummaryResponse? ToUserResponse(ItemUserResult? user)
    {
        if (user is null)
        {
            return null;
        }

        return new ItemUserSummaryResponse(
            user.Id.ToString(CultureInfo.InvariantCulture),
            user.UserName,
            user.DisplayName);
    }

    private static string ToApiFieldType(CustomFieldType fieldType)
    {
        return fieldType switch
        {
            CustomFieldType.SingleLine => "single_line",
            CustomFieldType.MultiLine => "multi_line",
            CustomFieldType.Number => "number",
            CustomFieldType.Link => "link",
            CustomFieldType.Bool => "bool",
            _ => throw new ArgumentOutOfRangeException(nameof(fieldType), fieldType, "Unsupported custom field type.")
        };
    }
}

public sealed record ItemInventorySummaryResponse(
    string Id,
    string Title);

public sealed record ItemFixedFieldsResponse(
    DateTime CreatedAt,
    DateTime UpdatedAt,
    ItemUserSummaryResponse? CreatedBy,
    ItemUserSummaryResponse? UpdatedBy);

public sealed record ItemUserSummaryResponse(
    string Id,
    string UserName,
    string DisplayName);

public sealed record ItemCustomFieldValueResponse(
    string FieldId,
    string FieldType,
    string Title,
    string Description,
    object? Value);

public sealed record ItemPermissionsResponse(
    bool CanEdit,
    bool CanDelete,
    bool CanLike);
