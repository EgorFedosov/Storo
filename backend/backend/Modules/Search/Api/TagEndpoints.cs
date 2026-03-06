using backend.Modules.Search.UseCases.AutocompleteTags;
using backend.Modules.Search.UseCases.GetTagCloud;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Search.Api;

public static class TagEndpoints
{
    private const int MinPrefixLength = 2;
    private const int MaxPrefixLength = 100;
    private const int AutocompleteLimit = 20;
    private const int TagCloudLimit = 30;

    public static void MapTagEndpoints(this RouteGroupBuilder apiGroup)
    {
        var tagsGroup = apiGroup
            .MapGroup("/tags")
            .WithMetadata(new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest));

        tagsGroup
            .MapGet("/autocomplete", AutocompleteAsync)
            .WithName("AutocompleteTags")
            .WithMetadata(new ProducesResponseTypeAttribute(typeof(TagAutocompleteResponse), StatusCodes.Status200OK));

        tagsGroup
            .MapGet("/cloud", GetCloudAsync)
            .WithName("GetTagCloud")
            .WithMetadata(new ProducesResponseTypeAttribute(typeof(TagCloudResponse), StatusCodes.Status200OK));
    }

    private static async Task<Results<Ok<TagAutocompleteResponse>, ValidationProblem>> AutocompleteAsync(
        [AsParameters] AutocompleteTagsRequest request,
        IAutocompleteTagsUseCase useCase,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var prefix = ParsePrefix(request.Prefix, errors);

        if (errors.Count > 0 || prefix is null)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var result = await useCase.ExecuteAsync(
            new AutocompleteTagsQuery(prefix, AutocompleteLimit),
            cancellationToken);

        return TypedResults.Ok(TagAutocompleteResponse.FromResult(result));
    }

    private static async Task<Ok<TagCloudResponse>> GetCloudAsync(
        IGetTagCloudUseCase useCase,
        CancellationToken cancellationToken)
    {
        var result = await useCase.ExecuteAsync(
            new GetTagCloudQuery(TagCloudLimit),
            cancellationToken);

        return TypedResults.Ok(TagCloudResponse.FromResult(result));
    }

    private static string? ParsePrefix(string? rawValue, IDictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            errors["prefix"] = ["prefix is required."];
            return null;
        }

        var prefix = rawValue.Trim();
        if (prefix.Length < MinPrefixLength)
        {
            errors["prefix"] = [$"prefix must be at least {MinPrefixLength} characters."];
            return null;
        }

        if (prefix.Length > MaxPrefixLength)
        {
            errors["prefix"] = [$"prefix must be {MaxPrefixLength} characters or less."];
            return null;
        }

        return prefix;
    }
}

public sealed record AutocompleteTagsRequest(
    [property: FromQuery(Name = "prefix")] string? Prefix);
