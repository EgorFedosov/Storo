namespace backend.Modules.Inventories.UseCases.ImageUpload;

public interface IImageStoragePresignService
{
    Task<ImageStoragePresignData> CreatePresignAsync(
        ImageStoragePresignRequest request,
        CancellationToken cancellationToken);
}

public sealed record ImageStoragePresignRequest(
    long ActorUserId,
    string FileName,
    string ContentType,
    long Size);

public sealed record ImageStoragePresignData(
    string UploadUrl,
    string Method,
    IReadOnlyDictionary<string, string> Headers,
    IReadOnlyDictionary<string, string> FormFields,
    string PublicUrl,
    DateTime ExpiresAtUtc);
