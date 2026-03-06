using backend.Modules.Inventories.Domain;

namespace backend.Modules.Items.UseCases.CreateItem;

public sealed record ItemResult(
    long Id,
    ItemInventoryResult Inventory,
    string CustomId,
    int Version,
    ItemFixedFieldsResult FixedFields,
    IReadOnlyList<ItemFieldResult> Fields,
    ItemLikeResult Like,
    ItemPermissionsResult Permissions);

public sealed record ItemInventoryResult(
    long Id,
    string Title);

public sealed record ItemFixedFieldsResult(
    DateTime CreatedAt,
    DateTime UpdatedAt,
    ItemUserResult? CreatedBy,
    ItemUserResult? UpdatedBy);

public sealed record ItemUserResult(
    long Id,
    string UserName,
    string DisplayName);

public sealed record ItemFieldResult(
    long FieldId,
    CustomFieldType FieldType,
    string Title,
    string Description,
    object? Value);

public sealed record ItemLikeResult(
    int Count,
    bool LikedByCurrentUser);

public sealed record ItemPermissionsResult(
    bool CanEdit,
    bool CanDelete,
    bool CanLike);
