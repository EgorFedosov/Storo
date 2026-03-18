namespace backend.Modules.Inventories.UseCases.GetInventoryEditor;

public sealed record InventoryEditorResult(
    long Id,
    int Version,
    InventoryEditorSettingsResult Settings,
    IReadOnlyList<InventoryEditorTagResult> Tags,
    InventoryEditorAccessResult Access,
    IReadOnlyList<InventoryEditorCustomFieldResult> CustomFields,
    InventoryEditorCustomIdTemplateResult CustomIdTemplate,
    InventoryEditorIntegrationsResult Integrations,
    InventoryEditorPermissionsResult Permissions);

public sealed record InventoryEditorSettingsResult(
    string Title,
    string DescriptionMarkdown,
    InventoryEditorCategoryResult Category,
    string? ImageUrl);

public sealed record InventoryEditorCategoryResult(int Id, string Name);

public sealed record InventoryEditorTagResult(long Id, string Name);

public sealed record InventoryEditorAccessResult(
    string Mode,
    IReadOnlyList<InventoryEditorWriterResult> Writers);

public sealed record InventoryEditorWriterResult(
    long Id,
    string UserName,
    string DisplayName,
    string Email,
    bool IsBlocked);

public sealed record InventoryEditorCustomFieldResult(
    long Id,
    string FieldType,
    string Title,
    string Description,
    bool ShowInTable);

public sealed record InventoryEditorCustomIdTemplateResult(
    bool IsEnabled,
    IReadOnlyList<InventoryEditorCustomIdTemplatePartResult> Parts,
    string? DerivedValidationRegex,
    InventoryEditorCustomIdTemplatePreviewResult Preview);

public sealed record InventoryEditorCustomIdTemplatePartResult(
    long Id,
    string PartType,
    string? FixedText,
    string? FormatPattern);

public sealed record InventoryEditorCustomIdTemplatePreviewResult(
    string SampleCustomId,
    IReadOnlyList<string> Warnings);

public sealed record InventoryEditorIntegrationsResult(
    InventoryEditorOdooIntegrationResult Odoo);

public sealed record InventoryEditorOdooIntegrationResult(
    bool Enabled,
    bool CanViewToken,
    bool CanGenerateToken,
    string TokenActionUrl,
    bool HasActiveToken,
    string? MaskedToken,
    DateTime? GeneratedAt);

public sealed record InventoryEditorPermissionsResult(
    bool CanEditInventory,
    bool CanManageAccess,
    bool CanManageCustomFields,
    bool CanManageCustomIdTemplate,
    bool CanWriteItems);
