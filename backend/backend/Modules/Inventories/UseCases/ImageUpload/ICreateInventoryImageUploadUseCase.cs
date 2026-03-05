namespace backend.Modules.Inventories.UseCases.ImageUpload;

public interface ICreateInventoryImageUploadUseCase
{
    Task<PresignResult> ExecuteAsync(
        CreateInventoryImageUploadCommand command,
        CancellationToken cancellationToken);
}
