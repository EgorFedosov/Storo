namespace backend.Modules.Inventories.Infrastructure.Storage;

public sealed class ImageStoragePresignOptions
{
    public const string SectionName = "ImageUploads";

    public string UploadBaseUrl { get; set; } = "https://uploads.example.com";

    public string PublicBaseUrl { get; set; } = "https://cdn.example.com";

    public string PathPrefix { get; set; } = "inventory-images";

    public int UrlTtlMinutes { get; set; } = 15;

    public string SigningSecret { get; set; } = string.Empty;
}
