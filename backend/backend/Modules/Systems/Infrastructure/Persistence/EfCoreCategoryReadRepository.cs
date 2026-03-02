using backend.Infrastructure.Persistence;
using backend.Modules.Systems.UseCases.Categories;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Systems.Infrastructure.Persistence;

public sealed class EfCoreCategoryReadRepository(AppDbContext dbContext) : ICategoryReadRepository
{
    public async Task<IReadOnlyList<CategorySummaryResult>> ListSortedAsync(CancellationToken cancellationToken)
    {
        return await dbContext.Categories
            .AsNoTracking()
            .OrderBy(category => category.Name)
            .Select(category => new CategorySummaryResult(category.Id, category.Name))
            .ToArrayAsync(cancellationToken);
    }
}
