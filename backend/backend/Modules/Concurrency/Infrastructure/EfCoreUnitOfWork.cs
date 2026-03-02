using backend.Infrastructure.Persistence;
using backend.Modules.Concurrency.UseCases.Versioning;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Concurrency.Infrastructure;

public sealed class EfCoreUnitOfWork(AppDbContext dbContext) : IUnitOfWork
{
    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException exception)
        {
            throw new ConcurrencyConflictException("Concurrency conflict detected while saving changes.", exception);
        }
    }
}
