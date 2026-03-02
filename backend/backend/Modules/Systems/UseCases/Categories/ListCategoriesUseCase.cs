namespace backend.Modules.Systems.UseCases.Categories;

public sealed class ListCategoriesUseCase(ICategoryReadRepository categoryReadRepository) : IListCategoriesUseCase
{
    public async Task<CategoriesResult> ExecuteAsync(ListCategoriesQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var categories = await categoryReadRepository.ListSortedAsync(cancellationToken);
        return new CategoriesResult(categories);
    }
}
