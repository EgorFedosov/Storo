using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using backend.Modules.Inventories.Domain;
using backend.Modules.Inventories.UseCases.CustomIdTemplate;

namespace backend.Modules.Inventories.Infrastructure.Services;

public sealed partial class DefaultCustomIdTemplateService : ICustomIdTemplateService
{
    private const string DefaultDateTimeFormat = "yyyyMMdd";
    private const string SequenceNotReservedWarning = "preview_sequence_is_not_reserved";

    public CustomIdTemplateComputationResult Compute(
        IReadOnlyList<CustomIdTemplatePartInput> parts,
        long? sequenceLastValue)
    {
        ArgumentNullException.ThrowIfNull(parts);

        if (parts.Count == 0)
        {
            return new CustomIdTemplateComputationResult(
                null,
                string.Empty,
                Array.Empty<string>());
        }

        var regexBuilder = new StringBuilder("^");
        var previewBuilder = new StringBuilder();
        var hasSequence = false;
        var nextSequenceValue = sequenceLastValue.GetValueOrDefault() + 1;

        foreach (var part in parts)
        {
            regexBuilder.Append(BuildPartRegex(part));

            switch (part.PartType)
            {
                case CustomIdPartType.FixedText:
                    previewBuilder.Append(part.FixedText ?? string.Empty);
                    break;
                case CustomIdPartType.Random20Bit:
                    previewBuilder.Append("1048575");
                    break;
                case CustomIdPartType.Random32Bit:
                    previewBuilder.Append("4294967295");
                    break;
                case CustomIdPartType.Random6Digit:
                    previewBuilder.Append("123456");
                    break;
                case CustomIdPartType.Random9Digit:
                    previewBuilder.Append("123456789");
                    break;
                case CustomIdPartType.Guid:
                    previewBuilder.Append("00000000-0000-0000-0000-000000000000");
                    break;
                case CustomIdPartType.DateTime:
                    previewBuilder.Append(FormatDatePart(part.FormatPattern));
                    break;
                case CustomIdPartType.Sequence:
                    previewBuilder.Append(FormatSequencePart(nextSequenceValue, part.FormatPattern));
                    hasSequence = true;
                    break;
                default:
                    throw new ArgumentOutOfRangeException(
                        nameof(part.PartType),
                        part.PartType,
                        "Unsupported custom id part type.");
            }
        }

        regexBuilder.Append('$');

        var warnings = hasSequence
            ? new[] { SequenceNotReservedWarning }
            : Array.Empty<string>();

        return new CustomIdTemplateComputationResult(
            regexBuilder.ToString(),
            previewBuilder.ToString(),
            warnings);
    }

    private static string BuildPartRegex(CustomIdTemplatePartInput part)
    {
        return part.PartType switch
        {
            CustomIdPartType.FixedText => EscapeRegexLiteral(part.FixedText ?? string.Empty),
            CustomIdPartType.Random20Bit => @"\d{1,7}",
            CustomIdPartType.Random32Bit => @"\d{1,10}",
            CustomIdPartType.Random6Digit => @"\d{6}",
            CustomIdPartType.Random9Digit => @"\d{9}",
            CustomIdPartType.Guid => @"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
            CustomIdPartType.DateTime => BuildDateTimeRegex(part.FormatPattern),
            CustomIdPartType.Sequence => BuildSequenceRegex(part.FormatPattern),
            _ => throw new ArgumentOutOfRangeException(nameof(part.PartType), part.PartType, "Unsupported custom id part type.")
        };
    }

    private static string BuildDateTimeRegex(string? formatPattern)
    {
        var pattern = string.IsNullOrWhiteSpace(formatPattern)
            ? DefaultDateTimeFormat
            : formatPattern.Trim();

        if (pattern.Length == 0)
        {
            return @"\d+";
        }

        var regexBuilder = new StringBuilder();

        for (var i = 0; i < pattern.Length; i++)
        {
            var symbol = pattern[i];
            if (!char.IsLetter(symbol))
            {
                regexBuilder.Append(EscapeRegexLiteral(symbol.ToString()));
                continue;
            }

            var tokenLength = 1;
            while (i + 1 < pattern.Length && pattern[i + 1] == symbol)
            {
                tokenLength++;
                i++;
            }

            if (!IsNumericDateToken(symbol))
            {
                return ".+";
            }

            regexBuilder.Append(@"\d{");
            regexBuilder.Append(tokenLength.ToString(CultureInfo.InvariantCulture));
            regexBuilder.Append('}');
        }

        return regexBuilder.Length == 0 ? ".+" : regexBuilder.ToString();
    }

    private static bool IsNumericDateToken(char symbol)
    {
        return symbol is 'y' or 'M' or 'd' or 'H' or 'h' or 'm' or 's' or 'f' or 'F';
    }

    private static string BuildSequenceRegex(string? formatPattern)
    {
        if (string.IsNullOrWhiteSpace(formatPattern))
        {
            return @"\d+";
        }

        var trimmed = formatPattern.Trim();
        if (trimmed.Length > 1
            && (trimmed[0] == 'D' || trimmed[0] == 'd')
            && int.TryParse(trimmed[1..], NumberStyles.None, CultureInfo.InvariantCulture, out var width)
            && width > 0)
        {
            return $@"\d{{{width.ToString(CultureInfo.InvariantCulture)}}}";
        }

        return @"\d+";
    }

    private static string FormatDatePart(string? formatPattern)
    {
        var now = DateTime.UtcNow;
        if (string.IsNullOrWhiteSpace(formatPattern))
        {
            return now.ToString(DefaultDateTimeFormat, CultureInfo.InvariantCulture);
        }

        try
        {
            return now.ToString(formatPattern.Trim(), CultureInfo.InvariantCulture);
        }
        catch (FormatException)
        {
            return now.ToString(DefaultDateTimeFormat, CultureInfo.InvariantCulture);
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
            return value.ToString(formatPattern.Trim(), CultureInfo.InvariantCulture);
        }
        catch (FormatException)
        {
            return value.ToString(CultureInfo.InvariantCulture);
        }
    }

    private static string EscapeRegexLiteral(string value)
    {
        return RegexMetacharacters().Replace(value, "\\$1");
    }

    [GeneratedRegex(@"([\\.^$|?*+()[\]{}])")]
    private static partial Regex RegexMetacharacters();
}
