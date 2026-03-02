namespace backend.Modules.Concurrency.UseCases.Versioning;

public interface IETagService
{
    bool TryParseIfMatch(string rawIfMatch, out IfMatchToken token);
    bool IsMatch(IfMatchToken token, int currentVersion);
    string ToETag(int version);
}
