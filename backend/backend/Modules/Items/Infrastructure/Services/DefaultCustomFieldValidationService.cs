using System.Globalization;
using backend.Modules.Inventories.Domain;
using backend.Modules.Items.UseCases.CreateItem;

namespace backend.Modules.Items.Infrastructure.Services;

public sealed class DefaultCustomFieldValidationService : ICustomFieldValidationService
{
    private const int MaxSingleLineLength = 1_000;
    private const int MaxMultiLineLength = 10_000;
    private const int MaxLinkLength = 2_048;
    private const decimal MinNumberValue = -99_999_999_999_999.9999m;
    private const decimal MaxNumberValue = 99_999_999_999_999.9999m;

    public IReadOnlyList<ValidatedItemFieldValue> ValidateForCreate(
        IReadOnlyList<CreateItemFieldInput> requestedFields,
        IReadOnlyList<CustomField> activeFields)
    {
        ArgumentNullException.ThrowIfNull(requestedFields);
        ArgumentNullException.ThrowIfNull(activeFields);

        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var activeFieldsById = activeFields
            .Where(static field => field.IsEnabled)
            .ToDictionary(static field => field.Id);
        var seenFieldIds = new HashSet<long>();
        var validatedValues = new List<ValidatedItemFieldValue>(requestedFields.Count);

        foreach (var requestedField in requestedFields)
        {
            var fieldPath = $"fields[{requestedField.Index}]";

            if (!seenFieldIds.Add(requestedField.FieldId))
            {
                errors[$"{fieldPath}.fieldId"] = ["Duplicate fieldId is not allowed."];
                continue;
            }

            if (!activeFieldsById.TryGetValue(requestedField.FieldId, out var activeField))
            {
                errors[$"{fieldPath}.fieldId"] = ["fieldId must reference an active custom field in this inventory."];
                continue;
            }

            if (!TryValidateValue(requestedField, activeField.FieldType, fieldPath, errors, out var validatedValue))
            {
                continue;
            }

            validatedValues.Add(validatedValue);
        }

        if (errors.Count > 0)
        {
            throw new ItemValidationException(errors);
        }

        return validatedValues;
    }

    private static bool TryValidateValue(
        CreateItemFieldInput input,
        CustomFieldType fieldType,
        string fieldPath,
        IDictionary<string, string[]> errors,
        out ValidatedItemFieldValue validatedValue)
    {
        validatedValue = fieldType switch
        {
            CustomFieldType.SingleLine => ValidateSingleLine(input, fieldPath, errors),
            CustomFieldType.MultiLine => ValidateMultiLine(input, fieldPath, errors),
            CustomFieldType.Number => ValidateNumber(input, fieldPath, errors),
            CustomFieldType.Link => ValidateLink(input, fieldPath, errors),
            CustomFieldType.Bool => ValidateBool(input, fieldPath, errors),
            _ => throw new ArgumentOutOfRangeException(nameof(fieldType), fieldType, "Unsupported custom field type.")
        };

        return !errors.ContainsKey($"{fieldPath}.value");
    }

    private static ValidatedItemFieldValue ValidateSingleLine(
        CreateItemFieldInput input,
        string fieldPath,
        IDictionary<string, string[]> errors)
    {
        if (input.ValueKind == ItemFieldValueKind.Null)
        {
            return CreateNullValue(input.FieldId, CustomFieldType.SingleLine);
        }

        if (input.ValueKind != ItemFieldValueKind.String || input.StringValue is null)
        {
            errors[$"{fieldPath}.value"] = ["value for single_line must be string or null."];
            return CreateNullValue(input.FieldId, CustomFieldType.SingleLine);
        }

        if (input.StringValue.Length > MaxSingleLineLength)
        {
            errors[$"{fieldPath}.value"] =
            [
                $"single_line value must be {MaxSingleLineLength.ToString(CultureInfo.InvariantCulture)} characters or less."
            ];
            return CreateNullValue(input.FieldId, CustomFieldType.SingleLine);
        }

        return new ValidatedItemFieldValue(
            input.FieldId,
            CustomFieldType.SingleLine,
            input.StringValue,
            null,
            null,
            null,
            null);
    }

    private static ValidatedItemFieldValue ValidateMultiLine(
        CreateItemFieldInput input,
        string fieldPath,
        IDictionary<string, string[]> errors)
    {
        if (input.ValueKind == ItemFieldValueKind.Null)
        {
            return CreateNullValue(input.FieldId, CustomFieldType.MultiLine);
        }

        if (input.ValueKind != ItemFieldValueKind.String || input.StringValue is null)
        {
            errors[$"{fieldPath}.value"] = ["value for multi_line must be string or null."];
            return CreateNullValue(input.FieldId, CustomFieldType.MultiLine);
        }

        if (input.StringValue.Length > MaxMultiLineLength)
        {
            errors[$"{fieldPath}.value"] =
            [
                $"multi_line value must be {MaxMultiLineLength.ToString(CultureInfo.InvariantCulture)} characters or less."
            ];
            return CreateNullValue(input.FieldId, CustomFieldType.MultiLine);
        }

        return new ValidatedItemFieldValue(
            input.FieldId,
            CustomFieldType.MultiLine,
            null,
            input.StringValue,
            null,
            null,
            null);
    }

    private static ValidatedItemFieldValue ValidateNumber(
        CreateItemFieldInput input,
        string fieldPath,
        IDictionary<string, string[]> errors)
    {
        if (input.ValueKind == ItemFieldValueKind.Null)
        {
            return CreateNullValue(input.FieldId, CustomFieldType.Number);
        }

        if (input.ValueKind != ItemFieldValueKind.Number || !input.NumberValue.HasValue)
        {
            errors[$"{fieldPath}.value"] = ["value for number must be numeric or null."];
            return CreateNullValue(input.FieldId, CustomFieldType.Number);
        }

        var value = input.NumberValue.Value;
        if (decimal.Round(value, 4, MidpointRounding.AwayFromZero) != value)
        {
            errors[$"{fieldPath}.value"] = ["number value must have no more than 4 decimal places."];
            return CreateNullValue(input.FieldId, CustomFieldType.Number);
        }

        if (value is < MinNumberValue or > MaxNumberValue)
        {
            errors[$"{fieldPath}.value"] = ["number value is out of supported range."];
            return CreateNullValue(input.FieldId, CustomFieldType.Number);
        }

        return new ValidatedItemFieldValue(
            input.FieldId,
            CustomFieldType.Number,
            null,
            null,
            value,
            null,
            null);
    }

    private static ValidatedItemFieldValue ValidateLink(
        CreateItemFieldInput input,
        string fieldPath,
        IDictionary<string, string[]> errors)
    {
        if (input.ValueKind == ItemFieldValueKind.Null)
        {
            return CreateNullValue(input.FieldId, CustomFieldType.Link);
        }

        if (input.ValueKind != ItemFieldValueKind.String || input.StringValue is null)
        {
            errors[$"{fieldPath}.value"] = ["value for link must be string or null."];
            return CreateNullValue(input.FieldId, CustomFieldType.Link);
        }

        if (input.StringValue.Length > MaxLinkLength)
        {
            errors[$"{fieldPath}.value"] =
            [
                $"link value must be {MaxLinkLength.ToString(CultureInfo.InvariantCulture)} characters or less."
            ];
            return CreateNullValue(input.FieldId, CustomFieldType.Link);
        }

        return new ValidatedItemFieldValue(
            input.FieldId,
            CustomFieldType.Link,
            null,
            null,
            null,
            input.StringValue,
            null);
    }

    private static ValidatedItemFieldValue ValidateBool(
        CreateItemFieldInput input,
        string fieldPath,
        IDictionary<string, string[]> errors)
    {
        if (input.ValueKind == ItemFieldValueKind.Null)
        {
            errors[$"{fieldPath}.value"] = ["value for bool must be true or false; null is not allowed."];
            return CreateNullValue(input.FieldId, CustomFieldType.Bool);
        }

        if (input.ValueKind != ItemFieldValueKind.Bool || !input.BoolValue.HasValue)
        {
            errors[$"{fieldPath}.value"] = ["value for bool must be true or false."];
            return CreateNullValue(input.FieldId, CustomFieldType.Bool);
        }

        return new ValidatedItemFieldValue(
            input.FieldId,
            CustomFieldType.Bool,
            null,
            null,
            null,
            null,
            input.BoolValue.Value);
    }

    private static ValidatedItemFieldValue CreateNullValue(long fieldId, CustomFieldType fieldType)
    {
        return new ValidatedItemFieldValue(
            fieldId,
            fieldType,
            null,
            null,
            null,
            null,
            null);
    }
}
