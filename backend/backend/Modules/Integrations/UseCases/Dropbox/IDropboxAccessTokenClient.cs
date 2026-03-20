namespace backend.Modules.Integrations.UseCases.Dropbox;

public interface IDropboxAccessTokenClient
{
    Task<DropboxAccessTokenResult> GetAccessTokenAsync(CancellationToken cancellationToken);
}

public sealed record DropboxAccessTokenResult(
    string AccessToken,
    int ExpiresInSeconds,
    string TokenType,
    string? Scope);
