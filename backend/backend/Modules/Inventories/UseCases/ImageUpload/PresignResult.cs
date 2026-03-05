namespace backend.Modules.Inventories.UseCases.ImageUpload;

public sealed record PresignResult(
    PresignUploadContractResult Upload,
    string PublicUrl);

public sealed record PresignUploadContractResult(
    string Url,
    string Method,
    IReadOnlyDictionary<string, string> Headers,
    IReadOnlyDictionary<string, string> FormFields,
    DateTime ExpiresAtUtc);
