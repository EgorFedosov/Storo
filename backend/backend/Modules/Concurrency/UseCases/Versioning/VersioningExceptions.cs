using Microsoft.AspNetCore.Http;

namespace backend.Modules.Concurrency.UseCases.Versioning;

public abstract class VersioningException(string message, Exception? innerException = null)
    : Exception(message, innerException)
{
    public abstract int StatusCode { get; }
    public abstract string Title { get; }
    public abstract string Code { get; }
}

public sealed class IfMatchRequiredException()
    : VersioningException("The If-Match header is required for this mutation endpoint.")
{
    public override int StatusCode => StatusCodes.Status428PreconditionRequired;
    public override string Title => "Precondition Required";
    public override string Code => "if_match_required";
}

public sealed class InvalidIfMatchTokenException(string rawIfMatch)
    : VersioningException($"Invalid If-Match header value: '{rawIfMatch}'.")
{
    public override int StatusCode => StatusCodes.Status400BadRequest;
    public override string Title => "Bad Request";
    public override string Code => "invalid_if_match";
}

public sealed class ConcurrencyConflictException : VersioningException
{
    public ConcurrencyConflictException(int expectedVersion, int actualVersion)
        : base($"Concurrency conflict detected. Expected version {expectedVersion}, but actual version is {actualVersion}.")
    {
    }

    public ConcurrencyConflictException(string message, Exception innerException)
        : base(message, innerException)
    {
    }

    public override int StatusCode => StatusCodes.Status412PreconditionFailed;
    public override string Title => "Precondition Failed";
    public override string Code => "concurrency_conflict";
}
