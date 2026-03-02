namespace backend.Modules.Systems.UseCases.Categories;

public interface IListCategoriesUseCase
{
    Task<CategoriesResult> ExecuteAsync(ListCategoriesQuery query, CancellationToken cancellationToken);
}
