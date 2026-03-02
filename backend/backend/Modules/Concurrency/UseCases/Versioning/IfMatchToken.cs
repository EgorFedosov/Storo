namespace backend.Modules.Concurrency.UseCases.Versioning;

public readonly record struct IfMatchToken(int Version)
{
    public static IfMatchToken FromVersion(int version)
    {
        if (version <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(version), "Version must be greater than zero.");
        }

        return new IfMatchToken(version);
    }
}
