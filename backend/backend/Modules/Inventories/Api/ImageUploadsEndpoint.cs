using System.Net.Http.Headers;
using backend.Modules.Auth.Api;
using backend.Modules.Inventories.Infrastructure.Storage;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Inventories.UseCases.ImageUpload;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Inventories.Api;

public static class ImageUploadsEndpoint
{
    private const int MaxFileNameLength = 255;
    private const int MaxContentTypeLength = 255;
    private static readonly string[] AllowedExtensions =
    [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".gif",
        ".bmp",
        ".pdf"
    ];
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/bmp",
        "application/pdf",
    };

    public static void MapImageUploadsEndpoint(this RouteGroupBuilder apiGroup)
    {
        apiGroup
            .MapPost("/uploads/images/presign", CreatePresignAsync)
            .WithName("CreateInventoryImageUpload")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ImagePresignResponse), StatusCodes.Status200OK),
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest))
            .RequireAuthenticatedAccess();

        apiGroup
            .MapPost("/uploads/files", UploadFileAsync)
            .DisableAntiforgery()
            .WithName("UploadInventoryFile")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(UploadInventoryFileResponse), StatusCodes.Status200OK),
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest))
            .RequireAuthenticatedAccess();

        apiGroup
            .MapDelete("/uploads/files", DeleteFileAsync)
            .WithName("DeleteInventoryFile")
            .WithMetadata(
                new ProducesResponseTypeAttribute(StatusCodes.Status204NoContent),
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest))
            .RequireAuthenticatedAccess();

        apiGroup
            .MapPost("/uploads/files/list", ListFilesAsync)
            .WithName("ListInventoryFiles")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ListInventoryFilesResponse), StatusCodes.Status200OK),
                new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest))
            .RequireAuthenticatedAccess();
    }

    private static async Task<Results<Ok<ImagePresignResponse>, ValidationProblem>> CreatePresignAsync(
        CreateInventoryImageUploadRequest request,
        ICurrentUserAccessor currentUserAccessor,
        ICreateInventoryImageUploadUseCase useCase,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        var fileName = ParseFileName(request.Filename, errors);
        var contentType = ParseContentType(request.ContentType, errors);
        var size = ParseSize(request.Size, errors);

        if (fileName is null || contentType is null || !size.HasValue || errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var actorUserId = currentUserAccessor.CurrentUser.UserId
                          ?? throw new InvalidOperationException(
                              "Authenticated user id claim is missing.");

        var result = await useCase.ExecuteAsync(
            new CreateInventoryImageUploadCommand(
                actorUserId,
                fileName,
                contentType,
                size.Value),
            cancellationToken);

        return TypedResults.Ok(ImagePresignResponse.FromResult(result));
    }

    private static async Task<Results<Ok<UploadInventoryFileResponse>, ValidationProblem>> UploadFileAsync(
        IFormFile? file,
        ICurrentUserAccessor currentUserAccessor,
        IInventoryAssetStorageService storageService,
        SupabaseStorageOptions options,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        if (file is null)
        {
            errors["file"] = ["file is required."];
            return TypedResults.ValidationProblem(errors);
        }

        var fileName = ParseFileName(file.FileName, errors);
        var contentType = ParseAllowedFileContentType(file.ContentType, file.FileName, errors);
        var size = ParseSize(file.Length, errors);
        if (size.HasValue && size.Value > options.MaxUploadSizeBytes)
        {
            errors["size"] = [$"size must be less than or equal to {options.MaxUploadSizeBytes} bytes."];
        }

        if (fileName is null || contentType is null || !size.HasValue || errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var actorUserId = currentUserAccessor.CurrentUser.UserId
                          ?? throw new InvalidOperationException(
                              "Authenticated user id claim is missing.");

        await using var content = file.OpenReadStream();

        var result = await storageService.UploadAsync(
            new InventoryAssetUploadRequest(
                actorUserId,
                fileName,
                contentType,
                size.Value,
                content),
            cancellationToken);

        return TypedResults.Ok(UploadInventoryFileResponse.FromResult(result));
    }

    private static async Task<Results<NoContent, ValidationProblem>> DeleteFileAsync(
        [FromBody] DeleteInventoryFileRequest request,
        IInventoryAssetStorageService storageService,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        var publicUrl = request.PublicUrl?.Trim();
        if (string.IsNullOrWhiteSpace(publicUrl))
        {
            errors["publicUrl"] = ["publicUrl is required."];
            return TypedResults.ValidationProblem(errors);
        }

        await storageService.DeleteByPublicUrlAsync(publicUrl, cancellationToken);
        return TypedResults.NoContent();
    }

    private static async Task<Results<Ok<ListInventoryFilesResponse>, ValidationProblem>> ListFilesAsync(
        ListInventoryFilesRequest request,
        IInventoryAssetStorageService storageService,
        SupabaseStorageOptions options,
        CancellationToken cancellationToken)
    {
        var limit = request.Limit ?? options.DefaultListLimit;
        if (limit <= 0)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["limit"] = ["limit must be greater than 0."]
            });
        }

        var items = await storageService.ListAsync(limit, cancellationToken);
        return TypedResults.Ok(ListInventoryFilesResponse.FromResult(items));
    }

    private static string? ParseFileName(string? rawFileName, IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(rawFileName))
        {
            errors["filename"] = ["filename is required."];
            return null;
        }

        var fileName = rawFileName.Trim();
        if (fileName.Length > MaxFileNameLength)
        {
            errors["filename"] = [$"filename must be {MaxFileNameLength} characters or less."];
            return null;
        }

        return fileName;
    }

    private static string? ParseContentType(string? rawContentType, IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(rawContentType))
        {
            errors["contentType"] = ["contentType is required."];
            return null;
        }

        var contentType = rawContentType.Trim();
        if (contentType.Length > MaxContentTypeLength)
        {
            errors["contentType"] = [$"contentType must be {MaxContentTypeLength} characters or less."];
            return null;
        }

        if (!MediaTypeHeaderValue.TryParse(contentType, out var mediaTypeHeader)
            || mediaTypeHeader.MediaType is null
            || !mediaTypeHeader.MediaType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            errors["contentType"] = ["contentType must be a valid image MIME type."];
            return null;
        }

        return mediaTypeHeader.MediaType;
    }

    private static string? ParseAllowedFileContentType(
        string? rawContentType,
        string? rawFileName,
        IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(rawFileName))
        {
            errors["file"] = ["file name is required."];
            return null;
        }

        var extension = Path.GetExtension(rawFileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase))
        {
            errors["file"] = ["Only .jpg, .jpeg, .png, .webp, .gif, .bmp, .pdf files are allowed."];
            return null;
        }

        var contentType = string.IsNullOrWhiteSpace(rawContentType)
            ? extension == ".pdf" ? "application/pdf" : "image/jpeg"
            : rawContentType.Trim();

        if (contentType.Length > MaxContentTypeLength)
        {
            errors["contentType"] = [$"contentType must be {MaxContentTypeLength} characters or less."];
            return null;
        }

        if (!MediaTypeHeaderValue.TryParse(contentType, out var mediaTypeHeader)
            || mediaTypeHeader.MediaType is null)
        {
            errors["contentType"] = ["contentType must be a valid MIME type."];
            return null;
        }

        var normalizedContentType = mediaTypeHeader.MediaType.Trim().ToLowerInvariant();

        if (!AllowedContentTypes.Contains(normalizedContentType))
        {
            errors["contentType"] = ["Only image/* (jpg, jpeg, png, webp, gif, bmp) and application/pdf are allowed."];
            return null;
        }

        if (extension == ".pdf" && !string.Equals(normalizedContentType, "application/pdf", StringComparison.OrdinalIgnoreCase))
        {
            errors["contentType"] = ["PDF files must have contentType application/pdf."];
            return null;
        }

        if (extension != ".pdf" && !normalizedContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            errors["contentType"] = ["Image files must have image/* contentType."];
            return null;
        }

        return normalizedContentType;
    }

    private static long? ParseSize(long? rawSize, IDictionary<string, string[]> errors)
    {
        if (rawSize is > 0)
        {
            return rawSize.Value;
        }

        errors["size"] = ["size must be a positive integer."];
        return null;
    }
}

public sealed record CreateInventoryImageUploadRequest(
    string? Filename,
    string? ContentType,
    long? Size);

public sealed record ImagePresignResponse(
    ImageUploadContractResponse Upload,
    string PublicUrl)
{
    public static ImagePresignResponse FromResult(PresignResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new ImagePresignResponse(
            new ImageUploadContractResponse(
                result.Upload.Url,
                result.Upload.Method,
                result.Upload.Headers,
                result.Upload.FormFields,
                result.Upload.ExpiresAtUtc),
            result.PublicUrl);
    }
}

public sealed record ImageUploadContractResponse(
    string Url,
    string Method,
    IReadOnlyDictionary<string, string> Headers,
    IReadOnlyDictionary<string, string> FormFields,
    DateTime ExpiresAtUtc);

public sealed record UploadInventoryFileResponse(
    string PublicUrl,
    string ObjectPath,
    string FileName,
    string ContentType,
    long Size)
{
    public static UploadInventoryFileResponse FromResult(InventoryAssetUploadResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new UploadInventoryFileResponse(
            result.PublicUrl,
            result.ObjectPath,
            result.FileName,
            result.ContentType,
            result.Size);
    }
}

public sealed record DeleteInventoryFileRequest(string? PublicUrl);

public sealed record ListInventoryFilesRequest(int? Limit);

public sealed record ListInventoryFilesResponse(IReadOnlyList<ListInventoryFileItemResponse> Items)
{
    public static ListInventoryFilesResponse FromResult(IReadOnlyList<InventoryAssetListItemResult> items)
    {
        return new ListInventoryFilesResponse(items.Select(ListInventoryFileItemResponse.FromResult).ToArray());
    }
}

public sealed record ListInventoryFileItemResponse(
    string Name,
    string PublicUrl,
    long? Size,
    DateTime? UpdatedAtUtc)
{
    public static ListInventoryFileItemResponse FromResult(InventoryAssetListItemResult item)
    {
        return new ListInventoryFileItemResponse(item.Name, item.PublicUrl, item.Size, item.UpdatedAtUtc);
    }
}
