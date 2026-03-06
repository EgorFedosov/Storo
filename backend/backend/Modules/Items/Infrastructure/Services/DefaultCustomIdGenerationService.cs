using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using backend.Modules.Inventories.Domain;
using backend.Modules.Items.UseCases.CreateItem;

namespace backend.Modules.Items.Infrastructure.Services;

public sealed class DefaultCustomIdGenerationService : ICustomIdGenerationService
{
    private const string DefaultDateTimeFormat = "yyyyMMdd";
    private const int MaxCustomIdLength = 500;

    public string ResolveCustomId(Inventory inventory, string? requestedCustomId, DateTime nowUtc)
    {
        ArgumentNullException.ThrowIfNull(inventory);

        var normalizedRequestedCustomId = NormalizeCustomId(requestedCustomId);
        if (normalizedRequestedCustomId is not null)
        {
            EnsureCustomIdLength(normalizedRequestedCustomId);
            EnsureMatchesTemplate(inventory.CustomIdTemplate, normalizedRequestedCustomId);
            return normalizedRequestedCustomId;
        }

        var generatedCustomId = GenerateCustomId(inventory, nowUtc);
        EnsureCustomIdLength(generatedCustomId);
        EnsureMatchesTemplate(inventory.CustomIdTemplate, generatedCustomId);
        return generatedCustomId;
    }

    private static string? NormalizeCustomId(string? customId)
    {
        if (string.IsNullOrWhiteSpace(customId))
        {
            return null;
        }

        return customId.Trim();
    }

    private static string GenerateCustomId(Inventory inventory, DateTime nowUtc)
    {
        var template = inventory.CustomIdTemplate;
        if (template is null || !template.IsEnabled || template.Parts.Count == 0)
        {
            return Guid.NewGuid().ToString("D");
        }

        var builder = new StringBuilder();
        long? sequenceValue = null;

        foreach (var part in template.Parts.OrderBy(static part => part.SortOrder).ThenBy(static part => part.Id))
        {
            switch (part.PartType)
            {
                case CustomIdPartType.FixedText:
                    builder.Append(part.FixedText ?? string.Empty);
                    break;
                case CustomIdPartType.Random20Bit:
                    builder.Append(RandomNumberGenerator.GetInt32(0, 1_048_576).ToString(CultureInfo.InvariantCulture));
                    break;
                case CustomIdPartType.Random32Bit:
                    builder.Append(GenerateRandomUInt32().ToString(CultureInfo.InvariantCulture));
                    break;
                case CustomIdPartType.Random6Digit:
                    builder.Append(RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6", CultureInfo.InvariantCulture));
                    break;
                case CustomIdPartType.Random9Digit:
                    builder.Append(RandomNumberGenerator.GetInt32(0, 1_000_000_000).ToString("D9", CultureInfo.InvariantCulture));
                    break;
                case CustomIdPartType.Guid:
                    builder.Append(Guid.NewGuid().ToString("D"));
                    break;
                case CustomIdPartType.DateTime:
                    builder.Append(FormatDateTimePart(part.FormatPattern, nowUtc));
                    break;
                case CustomIdPartType.Sequence:
                    sequenceValue ??= ConsumeSequenceValue(inventory, nowUtc);
                    builder.Append(FormatSequencePart(sequenceValue.Value, part.FormatPattern));
                    break;
                default:
                    throw new ArgumentOutOfRangeException(
                        nameof(part.PartType),
                        part.PartType,
                        "Unsupported custom id part type.");
            }
        }

        return builder.ToString();
    }

    private static uint GenerateRandomUInt32()
    {
        Span<byte> bytes = stackalloc byte[sizeof(uint)];
        RandomNumberGenerator.Fill(bytes);
        return BitConverter.ToUInt32(bytes);
    }

    private static long ConsumeSequenceValue(Inventory inventory, DateTime nowUtc)
    {
        var nextValue = inventory.CustomIdSequenceState is null
            ? 1
            : inventory.CustomIdSequenceState.LastValue + 1;

        if (inventory.CustomIdSequenceState is null)
        {
            inventory.CustomIdSequenceState = new CustomIdSequenceState
            {
                InventoryId = inventory.Id,
                LastValue = nextValue,
                UpdatedAt = nowUtc
            };
        }
        else
        {
            inventory.CustomIdSequenceState.LastValue = nextValue;
            inventory.CustomIdSequenceState.UpdatedAt = nowUtc;
        }

        return nextValue;
    }

    private static string FormatDateTimePart(string? formatPattern, DateTime nowUtc)
    {
        if (string.IsNullOrWhiteSpace(formatPattern))
        {
            return nowUtc.ToString(DefaultDateTimeFormat, CultureInfo.InvariantCulture);
        }

        try
        {
            return nowUtc.ToString(formatPattern.Trim(), CultureInfo.InvariantCulture);
        }
        catch (FormatException)
        {
            return nowUtc.ToString(DefaultDateTimeFormat, CultureInfo.InvariantCulture);
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

    private static void EnsureCustomIdLength(string customId)
    {
        if (customId.Length <= MaxCustomIdLength)
        {
            return;
        }

        throw CreateCustomIdValidationException(
            $"customId must be {MaxCustomIdLength.ToString(CultureInfo.InvariantCulture)} characters or less.");
    }

    private static void EnsureMatchesTemplate(CustomIdTemplate? template, string customId)
    {
        if (template is null || !template.IsEnabled || string.IsNullOrWhiteSpace(template.ValidationRegex))
        {
            return;
        }

        var matches = Regex.IsMatch(
            customId,
            template.ValidationRegex,
            RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(250));

        if (matches)
        {
            return;
        }

        throw CreateCustomIdValidationException("customId does not match the current custom-id template.");
    }

    private static ItemValidationException CreateCustomIdValidationException(string message)
    {
        return new ItemValidationException(new Dictionary<string, string[]>
        {
            ["customId"] = [message]
        });
    }
}
