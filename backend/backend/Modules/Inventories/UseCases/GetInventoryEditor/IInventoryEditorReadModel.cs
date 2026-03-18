using backend.Modules.Inventories.Domain;

namespace backend.Modules.Inventories.UseCases.GetInventoryEditor;

public interface IInventoryEditorReadModel
{
    Task<InventoryEditorReadModel?> GetAsync(long inventoryId, CancellationToken cancellationToken);
}

public sealed record InventoryEditorReadModel(
    long Id,
    int Version,
    long CreatorId,
    string Title,
    string DescriptionMarkdown,
    int CategoryId,
    string CategoryName,
    string? ImageUrl,
    bool IsPublic,
    IReadOnlyList<InventoryEditorTagReadModel> Tags,
    IReadOnlyList<InventoryEditorWriterReadModel> Writers,
    IReadOnlyList<InventoryEditorCustomFieldReadModel> CustomFields,
    InventoryEditorCustomIdTemplateReadModel? CustomIdTemplate,
    long? SequenceLastValue,
    InventoryEditorActiveApiTokenReadModel? ActiveApiToken);

public sealed record InventoryEditorTagReadModel(long Id, string Name);

public sealed record InventoryEditorWriterReadModel(
    long Id,
    string UserName,
    string DisplayName,
    string Email,
    bool IsBlocked);

public sealed record InventoryEditorCustomFieldReadModel(
    long Id,
    CustomFieldType FieldType,
    string Title,
    string Description,
    bool ShowInTable);

public sealed record InventoryEditorCustomIdTemplateReadModel(
    bool IsEnabled,
    string? ValidationRegex,
    IReadOnlyList<InventoryEditorCustomIdTemplatePartReadModel> Parts);

public sealed record InventoryEditorCustomIdTemplatePartReadModel(
    long Id,
    CustomIdPartType PartType,
    string? FixedText,
    string? FormatPattern);

public sealed record InventoryEditorActiveApiTokenReadModel(
    string TokenHash,
    DateTime CreatedAt);

