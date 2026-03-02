using backend.Modules.Systems.UseCases.Categories;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Systems.Api;

public static class CategoriesEndpoint
{
    public static void MapCategoriesEndpoint(this RouteGroupBuilder apiGroup)
    {
        apiGroup
            .MapGet(
                "/categories",
                async Task<Ok<CategoriesResponse>> (IListCategoriesUseCase useCase, CancellationToken cancellationToken) =>
                {
                    var result = await useCase.ExecuteAsync(new ListCategoriesQuery(), cancellationToken);
                    return TypedResults.Ok(CategoriesResponse.FromResult(result));
                })
            .WithName("ListCategories");
    }
}
