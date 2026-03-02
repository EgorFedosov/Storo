namespace backend.Modules.Systems.UseCases.Categories;

public interface ICategoryReadRepository
{
    Task<IReadOnlyList<CategorySummaryResult>> ListSortedAsync(CancellationToken cancellationToken);
}
