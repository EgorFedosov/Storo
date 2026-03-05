using System.Net.Http.Headers;
using backend.Modules.Auth.Api;
using backend.Modules.Auth.UseCases.Authorization;
using backend.Modules.Inventories.UseCases.ImageUpload;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Inventories.Api;

public static class ImageUploadsEndpoint
{
    private const int MaxFileNameLength = 255;
    private const int MaxContentTypeLength = 255;

    public static void MapImageUploadsEndpoint(this RouteGroupBuilder apiGroup)
    {
        apiGroup
            .MapPost("/uploads/images/presign", CreatePresignAsync)
            .WithName("CreateInventoryImageUpload")
            .WithMetadata(
                new ProducesResponseTypeAttribute(typeof(ImagePresignResponse), StatusCodes.Status200OK),
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
