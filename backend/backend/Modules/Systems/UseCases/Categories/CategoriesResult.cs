namespace backend.Modules.Systems.UseCases.Categories;

public sealed record CategoriesResult(IReadOnlyList<CategorySummaryResult> Categories);

public sealed record CategorySummaryResult(
    int Id,
    string Name);
