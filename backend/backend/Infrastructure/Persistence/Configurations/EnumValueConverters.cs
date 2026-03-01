using backend.Modules.Inventories.Domain;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace backend.Infrastructure.Persistence.Configurations;

public static class EnumValueConverters
{
    public static readonly ValueConverter<CustomFieldType, string> CustomFieldTypeConverter = new(
        value => ToCustomFieldTypeValue(value),
        value => FromCustomFieldTypeValue(value));

    public static readonly ValueConverter<CustomIdPartType, string> CustomIdPartTypeConverter = new(
        value => ToCustomIdPartTypeValue(value),
        value => FromCustomIdPartTypeValue(value));

    private static string ToCustomFieldTypeValue(CustomFieldType value)
    {
        return value switch
        {
            CustomFieldType.SingleLine => "single_line",
            CustomFieldType.MultiLine => "multi_line",
            CustomFieldType.Number => "number",
            CustomFieldType.Link => "link",
            CustomFieldType.Bool => "bool",
            _ => throw new ArgumentOutOfRangeException(nameof(value), value, null)
        };
    }

    private static CustomFieldType FromCustomFieldTypeValue(string value)
    {
        return value switch
        {
            "single_line" => CustomFieldType.SingleLine,
            "multi_line" => CustomFieldType.MultiLine,
            "number" => CustomFieldType.Number,
            "link" => CustomFieldType.Link,
            "bool" => CustomFieldType.Bool,
            _ => throw new ArgumentOutOfRangeException(nameof(value), value, null)
        };
    }

    private static string ToCustomIdPartTypeValue(CustomIdPartType value)
    {
        return value switch
        {
            CustomIdPartType.FixedText => "fixed_text",
            CustomIdPartType.Random20Bit => "random_20_bit",
            CustomIdPartType.Random32Bit => "random_32_bit",
            CustomIdPartType.Random6Digit => "random_6_digit",
            CustomIdPartType.Random9Digit => "random_9_digit",
            CustomIdPartType.Guid => "guid",
            CustomIdPartType.DateTime => "datetime",
            CustomIdPartType.Sequence => "sequence",
            _ => throw new ArgumentOutOfRangeException(nameof(value), value, null)
        };
    }

    private static CustomIdPartType FromCustomIdPartTypeValue(string value)
    {
        return value switch
        {
            "fixed_text" => CustomIdPartType.FixedText,
            "random_20_bit" => CustomIdPartType.Random20Bit,
            "random_32_bit" => CustomIdPartType.Random32Bit,
            "random_6_digit" => CustomIdPartType.Random6Digit,
            "random_9_digit" => CustomIdPartType.Random9Digit,
            "guid" => CustomIdPartType.Guid,
            "datetime" => CustomIdPartType.DateTime,
            "sequence" => CustomIdPartType.Sequence,
            _ => throw new ArgumentOutOfRangeException(nameof(value), value, null)
        };
    }
}
