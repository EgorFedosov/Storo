namespace backend.Modules.Inventories.UseCases.ImageUpload;

public sealed record CreateInventoryImageUploadCommand(
    long ActorUserId,
    string FileName,
    string ContentType,
    long Size);
