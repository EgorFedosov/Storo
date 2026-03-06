using backend.Modules.Inventories.Domain;

namespace backend.Modules.Items.UseCases.CreateItem;

public interface ICustomFieldValidationService
{
    IReadOnlyList<ValidatedItemFieldValue> ValidateForCreate(
        IReadOnlyList<CreateItemFieldInput> requestedFields,
        IReadOnlyList<CustomField> activeFields);
}

public sealed record ValidatedItemFieldValue(
    long FieldId,
    CustomFieldType FieldType,
    string? StringValue,
    string? TextValue,
    decimal? NumberValue,
    string? LinkValue,
    bool? BoolValue)
{
    public bool HasAnyValue =>
        StringValue is not null
        || TextValue is not null
        || NumberValue.HasValue
        || LinkValue is not null
        || BoolValue.HasValue;
}
