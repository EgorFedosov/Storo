namespace backend.Modules.Inventories.UseCases.ImageUpload;

public sealed class CreateInventoryImageUploadUseCase(
    IImageStoragePresignService imageStoragePresignService) : ICreateInventoryImageUploadUseCase
{
    public async Task<PresignResult> ExecuteAsync(
        CreateInventoryImageUploadCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        var presignData = await imageStoragePresignService.CreatePresignAsync(
            new ImageStoragePresignRequest(
                command.ActorUserId,
                command.FileName,
                command.ContentType,
                command.Size),
            cancellationToken);

        return new PresignResult(
            new PresignUploadContractResult(
                presignData.UploadUrl,
                presignData.Method,
                presignData.Headers,
                presignData.FormFields,
                presignData.ExpiresAtUtc),
            presignData.PublicUrl);
    }
}
