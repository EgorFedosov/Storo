using System.Globalization;
using backend.Modules.Inventories.UseCases.GetInventoryEditor;

namespace backend.Modules.Inventories.Api;

public sealed record InventoryEditorResponse(
    string Id,
    int Version,
    InventoryEditorSettingsResponse Settings,
    IReadOnlyList<InventoryEditorTagResponse> Tags,
    InventoryEditorAccessResponse Access,
    IReadOnlyList<InventoryEditorCustomFieldResponse> CustomFields,
    InventoryEditorCustomIdTemplateResponse CustomIdTemplate,
    InventoryEditorIntegrationsResponse Integrations,
    InventoryEditorPermissionsResponse Permissions)
{
    public static InventoryEditorResponse FromResult(InventoryEditorResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new InventoryEditorResponse(
            result.Id.ToString(CultureInfo.InvariantCulture),
            result.Version,
            new InventoryEditorSettingsResponse(
                result.Settings.Title,
                result.Settings.DescriptionMarkdown,
                new InventoryEditorCategoryResponse(
                    result.Settings.Category.Id,
                    result.Settings.Category.Name),
                result.Settings.ImageUrl),
            result.Tags
                .Select(tag => new InventoryEditorTagResponse(
                    tag.Id.ToString(CultureInfo.InvariantCulture),
                    tag.Name))
                .ToArray(),
            new InventoryEditorAccessResponse(
                result.Access.Mode,
                result.Access.Writers
                    .Select(writer => new InventoryEditorWriterResponse(
                        writer.Id.ToString(CultureInfo.InvariantCulture),
                        writer.UserName,
                        writer.DisplayName,
                        writer.Email,
                        writer.IsBlocked))
                    .ToArray()),
            result.CustomFields
                .Select(customField => new InventoryEditorCustomFieldResponse(
                    customField.Id.ToString(CultureInfo.InvariantCulture),
                    customField.FieldType,
                    customField.Title,
                    customField.Description,
                    customField.ShowInTable))
                .ToArray(),
            new InventoryEditorCustomIdTemplateResponse(
                result.CustomIdTemplate.IsEnabled,
                result.CustomIdTemplate.Parts
                    .Select(part => new InventoryEditorCustomIdTemplatePartResponse(
                        part.Id.ToString(CultureInfo.InvariantCulture),
                        part.PartType,
                        part.FixedText,
                        part.FormatPattern))
                    .ToArray(),
                result.CustomIdTemplate.DerivedValidationRegex,
                new InventoryEditorCustomIdTemplatePreviewResponse(
                    result.CustomIdTemplate.Preview.SampleCustomId,
                    result.CustomIdTemplate.Preview.Warnings.ToArray())),
            new InventoryEditorIntegrationsResponse(
                new InventoryEditorOdooIntegrationResponse(
                    result.Integrations.Odoo.Enabled,
                    result.Integrations.Odoo.CanViewToken,
                    result.Integrations.Odoo.CanGenerateToken,
                    result.Integrations.Odoo.TokenActionUrl,
                    result.Integrations.Odoo.HasActiveToken,
                    result.Integrations.Odoo.MaskedToken,
                    result.Integrations.Odoo.GeneratedAt)),
            new InventoryEditorPermissionsResponse(
                result.Permissions.CanEditInventory,
                result.Permissions.CanManageAccess,
                result.Permissions.CanManageCustomFields,
                result.Permissions.CanManageCustomIdTemplate,
                result.Permissions.CanWriteItems));
    }
}

public sealed record InventoryEditorSettingsResponse(
    string Title,
    string DescriptionMarkdown,
    InventoryEditorCategoryResponse Category,
    string? ImageUrl);

public sealed record InventoryEditorCategoryResponse(int Id, string Name);

public sealed record InventoryEditorTagResponse(string Id, string Name);

public sealed record InventoryEditorAccessResponse(
    string Mode,
    IReadOnlyList<InventoryEditorWriterResponse> Writers);

public sealed record InventoryEditorWriterResponse(
    string Id,
    string UserName,
    string DisplayName,
    string Email,
    bool IsBlocked);

public sealed record InventoryEditorCustomFieldResponse(
    string Id,
    string FieldType,
    string Title,
    string Description,
    bool ShowInTable);

public sealed record InventoryEditorCustomIdTemplateResponse(
    bool IsEnabled,
    IReadOnlyList<InventoryEditorCustomIdTemplatePartResponse> Parts,
    string? DerivedValidationRegex,
    InventoryEditorCustomIdTemplatePreviewResponse Preview);

public sealed record InventoryEditorCustomIdTemplatePartResponse(
    string Id,
    string PartType,
    string? FixedText,
    string? FormatPattern);

public sealed record InventoryEditorCustomIdTemplatePreviewResponse(
    string SampleCustomId,
    IReadOnlyList<string> Warnings);

public sealed record InventoryEditorIntegrationsResponse(
    InventoryEditorOdooIntegrationResponse Odoo);

public sealed record InventoryEditorOdooIntegrationResponse(
    bool Enabled,
    bool CanViewToken,
    bool CanGenerateToken,
    string TokenActionUrl,
    bool HasActiveToken,
    string? MaskedToken,
    DateTime? GeneratedAt);

public sealed record InventoryEditorPermissionsResponse(
    bool CanEditInventory,
    bool CanManageAccess,
    bool CanManageCustomFields,
    bool CanManageCustomIdTemplate,
    bool CanWriteItems);
