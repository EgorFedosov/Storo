using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using backend.Modules.Inventories.Domain;

namespace backend.Modules.Inventories.UseCases.GetInventoryEditor;

public static class InventoryEditorResultFactory
{
    private const string PublicAccessMode = "public";
    private const string RestrictedAccessMode = "restricted";
    private const string OdooTokenActionUrlFormat = "/api/v1/integrations/odoo/inventories/{0}/token";

    public static InventoryEditorResult Create(InventoryEditorReadModel aggregate)
    {
        ArgumentNullException.ThrowIfNull(aggregate);

        var tags = aggregate.Tags
            .Select(tag => new InventoryEditorTagResult(tag.Id, tag.Name))
            .ToArray();

        var writers = aggregate.Writers
            .Select(writer => new InventoryEditorWriterResult(
                writer.Id,
                writer.UserName,
                writer.DisplayName,
                writer.Email,
                writer.IsBlocked))
            .ToArray();

        var customFields = aggregate.CustomFields
            .Select(field => new InventoryEditorCustomFieldResult(
                field.Id,
                ToApiFieldType(field.FieldType),
                field.Title,
                field.Description,
                field.ShowInTable))
            .ToArray();

        var customIdTemplate = CreateTemplateResult(aggregate.CustomIdTemplate, aggregate.SequenceLastValue);
        var integrations = CreateIntegrationsResult(aggregate);

        return new InventoryEditorResult(
            aggregate.Id,
            aggregate.Version,
            new InventoryEditorSettingsResult(
                aggregate.Title,
                aggregate.DescriptionMarkdown,
                new InventoryEditorCategoryResult(aggregate.CategoryId, aggregate.CategoryName),
                aggregate.ImageUrl),
            tags,
            new InventoryEditorAccessResult(
                aggregate.IsPublic ? PublicAccessMode : RestrictedAccessMode,
                writers),
            customFields,
            customIdTemplate,
            integrations,
            new InventoryEditorPermissionsResult(
                true,
                true,
                true,
                true,
                true));
    }

    private static InventoryEditorIntegrationsResult CreateIntegrationsResult(InventoryEditorReadModel aggregate)
    {
        var activeToken = aggregate.ActiveApiToken;
        return new InventoryEditorIntegrationsResult(
            new InventoryEditorOdooIntegrationResult(
                true,
                true,
                true,
                string.Format(CultureInfo.InvariantCulture, OdooTokenActionUrlFormat, aggregate.Id),
                activeToken is not null,
                activeToken is null ? null : CreateMaskedToken(activeToken.TokenHash),
                activeToken?.CreatedAt));
    }

    private static string CreateMaskedToken(string tokenHash)
    {
        var normalizedHash = tokenHash?.Trim() ?? string.Empty;
        if (normalizedHash.Length == 0)
        {
            return "odoo_************";
        }

        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(normalizedHash));
        var suffix = Convert.ToHexString(digest).ToLowerInvariant()[^4..];
        return $"odoo_************{suffix}";
    }

    private static InventoryEditorCustomIdTemplateResult CreateTemplateResult(
        InventoryEditorCustomIdTemplateReadModel? template,
        long? sequenceLastValue)
    {
        if (template is null)
        {
            return new InventoryEditorCustomIdTemplateResult(
                false,
                Array.Empty<InventoryEditorCustomIdTemplatePartResult>(),
                null,
                new InventoryEditorCustomIdTemplatePreviewResult(string.Empty, Array.Empty<string>()));
        }

        var parts = template.Parts
            .Select(part => new InventoryEditorCustomIdTemplatePartResult(
                part.Id,
                ToApiPartType(part.PartType),
                part.FixedText,
                part.FormatPattern))
            .ToArray();

        var preview = BuildPreview(parts, sequenceLastValue);
        return new InventoryEditorCustomIdTemplateResult(
            template.IsEnabled,
            parts,
            template.ValidationRegex,
            preview);
    }

    private static InventoryEditorCustomIdTemplatePreviewResult BuildPreview(
        IReadOnlyList<InventoryEditorCustomIdTemplatePartResult> parts,
        long? sequenceLastValue)
    {
        if (parts.Count == 0)
        {
            return new InventoryEditorCustomIdTemplatePreviewResult(string.Empty, Array.Empty<string>());
        }

        var sequenceValue = sequenceLastValue.GetValueOrDefault() + 1;
        var previewBuilder = new StringBuilder();
        var hasSequence = false;

        foreach (var part in parts)
        {
            switch (part.PartType)
            {
                case "fixed_text":
                    previewBuilder.Append(part.FixedText ?? string.Empty);
                    break;
                case "random_20_bit":
                    previewBuilder.Append("1048575");
                    break;
                case "random_32_bit":
                    previewBuilder.Append("4294967295");
                    break;
                case "random_6_digit":
                    previewBuilder.Append("123456");
                    break;
                case "random_9_digit":
                    previewBuilder.Append("123456789");
                    break;
                case "guid":
                    previewBuilder.Append("00000000-0000-0000-0000-000000000000");
                    break;
                case "datetime":
                    previewBuilder.Append(FormatDatePart(part.FormatPattern));
                    break;
                case "sequence":
                    previewBuilder.Append(FormatSequencePart(sequenceValue, part.FormatPattern));
                    hasSequence = true;
                    break;
            }
        }

        var warnings = hasSequence
            ? ["preview_sequence_is_not_reserved"]
            : Array.Empty<string>();

        return new InventoryEditorCustomIdTemplatePreviewResult(previewBuilder.ToString(), warnings);
    }

    private static string FormatDatePart(string? formatPattern)
    {
        var now = DateTime.UtcNow;
        if (string.IsNullOrWhiteSpace(formatPattern))
        {
            return now.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        }

        try
        {
            return now.ToString(formatPattern, CultureInfo.InvariantCulture);
        }
        catch (FormatException)
        {
            return now.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        }
    }

    private static string FormatSequencePart(long value, string? formatPattern)
    {
        if (string.IsNullOrWhiteSpace(formatPattern))
        {
            return value.ToString(CultureInfo.InvariantCulture);
        }

        try
        {
            return value.ToString(formatPattern, CultureInfo.InvariantCulture);
        }
        catch (FormatException)
        {
            return value.ToString(CultureInfo.InvariantCulture);
        }
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

    private static string ToApiPartType(CustomIdPartType partType)
    {
        return partType switch
        {
            CustomIdPartType.FixedText => "fixed_text",
            CustomIdPartType.Random20Bit => "random_20_bit",
            CustomIdPartType.Random32Bit => "random_32_bit",
            CustomIdPartType.Random6Digit => "random_6_digit",
            CustomIdPartType.Random9Digit => "random_9_digit",
            CustomIdPartType.Guid => "guid",
            CustomIdPartType.DateTime => "datetime",
            CustomIdPartType.Sequence => "sequence",
            _ => throw new ArgumentOutOfRangeException(nameof(partType), partType, "Unsupported custom id part type.")
        };
    }
}
