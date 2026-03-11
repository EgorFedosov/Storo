namespace backend.Modules.Inventories.UseCases.ImageUpload;

public interface IInventoryAssetStorageService
{
    Task<InventoryAssetUploadResult> UploadAsync(
        InventoryAssetUploadRequest request,
        CancellationToken cancellationToken);

    Task DeleteByPublicUrlAsync(
        string publicUrl,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<InventoryAssetListItemResult>> ListAsync(
        int limit,
        CancellationToken cancellationToken);
}

public sealed record InventoryAssetUploadRequest(
    long ActorUserId,
    string FileName,
    string ContentType,
    long Size,
    Stream Content);

public sealed record InventoryAssetUploadResult(
    string PublicUrl,
    string ObjectPath,
    string FileName,
    string ContentType,
    long Size);

public sealed record InventoryAssetListItemResult(
    string Name,
    string PublicUrl,
    long? Size,
    DateTime? UpdatedAtUtc);
