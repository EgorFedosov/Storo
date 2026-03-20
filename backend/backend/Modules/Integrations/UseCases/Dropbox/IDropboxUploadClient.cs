namespace backend.Modules.Integrations.UseCases.Dropbox;

public interface IDropboxUploadClient
{
    Task<DropboxUploadResult> UploadJsonAsync(
        DropboxJsonUploadRequest request,
        CancellationToken cancellationToken);
}

public sealed record DropboxJsonUploadRequest(
    string AccessToken,
    string FileName,
    string JsonPayload);

public sealed record DropboxUploadResult(
    string FileId,
    string PathDisplay,
    string Rev,
    DateTime ServerModifiedUtc,
    long Size);
