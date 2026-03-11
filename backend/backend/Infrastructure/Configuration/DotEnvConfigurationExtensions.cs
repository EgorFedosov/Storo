using Microsoft.Extensions.Configuration;

namespace backend.Infrastructure.Configuration;

public static class DotEnvConfigurationExtensions
{
    public static IConfigurationBuilder AddDotEnvFile(
        this IConfigurationBuilder configurationBuilder,
        string filePath)
    {
        ArgumentNullException.ThrowIfNull(configurationBuilder);

        if (!File.Exists(filePath))
        {
            return configurationBuilder;
        }

        var values = ParseLines(File.ReadAllLines(filePath));
        if (values.Count == 0)
        {
            return configurationBuilder;
        }

        configurationBuilder.AddInMemoryCollection(values);
        return configurationBuilder;
    }

    private static Dictionary<string, string?> ParseLines(IEnumerable<string> lines)
    {
        var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

        foreach (var rawLine in lines)
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || line.StartsWith('#'))
            {
                continue;
            }

            if (line.StartsWith("export ", StringComparison.Ordinal))
            {
                line = line["export ".Length..].TrimStart();
            }

            var delimiterIndex = line.IndexOf('=');
            if (delimiterIndex <= 0)
            {
                continue;
            }

            var key = line[..delimiterIndex].Trim();
            if (key.Length == 0)
            {
                continue;
            }

            var value = line[(delimiterIndex + 1)..].Trim();
            values[NormalizeKey(key)] = NormalizeValue(value);
        }

        return values;
    }

    private static string NormalizeKey(string key)
    {
        return key.Replace("__", ":", StringComparison.Ordinal);
    }

    private static string NormalizeValue(string value)
    {
        if (value.Length >= 2 && value.StartsWith('"') && value.EndsWith('"'))
        {
            return value[1..^1]
                .Replace("\\n", "\n", StringComparison.Ordinal)
                .Replace("\\r", "\r", StringComparison.Ordinal)
                .Replace("\\t", "\t", StringComparison.Ordinal)
                .Replace("\\\"", "\"", StringComparison.Ordinal);
        }

        if (value.Length >= 2 && value.StartsWith('\'') && value.EndsWith('\''))
        {
            return value[1..^1];
        }

        return value;
    }
}
