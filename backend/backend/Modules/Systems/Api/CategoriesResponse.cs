using backend.Modules.Systems.UseCases.Categories;

namespace backend.Modules.Systems.Api;

public sealed record CategoriesResponse(IReadOnlyList<CategoryResponse> Categories)
{
    public static CategoriesResponse FromResult(CategoriesResult result) =>
        new(result.Categories.Select(CategoryResponse.FromResult).ToArray());
}

public sealed record CategoryResponse(int Id, string Name)
{
    public static CategoryResponse FromResult(CategorySummaryResult result) =>
        new(result.Id, result.Name);
}
