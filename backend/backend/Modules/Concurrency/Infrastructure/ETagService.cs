using System.Globalization;
using backend.Modules.Concurrency.UseCases.Versioning;

namespace backend.Modules.Concurrency.Infrastructure;

public sealed class ETagService : IETagService
{
    public bool TryParseIfMatch(string rawIfMatch, out IfMatchToken token)
    {
        token = default;

        if (string.IsNullOrWhiteSpace(rawIfMatch))
        {
            return false;
        }

        var candidates = rawIfMatch.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (candidates.Length != 1)
        {
            return false;
        }

        var candidate = candidates[0];
        if (candidate == "*")
        {
            return false;
        }

        if (candidate.StartsWith("W/", StringComparison.OrdinalIgnoreCase))
        {
            candidate = candidate[2..].Trim();
        }

        if (candidate.Length >= 2 && candidate[0] == '"' && candidate[^1] == '"')
        {
            candidate = candidate[1..^1];
        }

        if (!int.TryParse(candidate, NumberStyles.None, CultureInfo.InvariantCulture, out var parsedVersion)
            || parsedVersion <= 0)
        {
            return false;
        }

        token = IfMatchToken.FromVersion(parsedVersion);
        return true;
    }

    public bool IsMatch(IfMatchToken token, int currentVersion)
    {
        return currentVersion > 0 && token.Version == currentVersion;
    }

    public string ToETag(int version)
    {
        var token = IfMatchToken.FromVersion(version);
        return $"\"{token.Version.ToString(CultureInfo.InvariantCulture)}\"";
    }
}
