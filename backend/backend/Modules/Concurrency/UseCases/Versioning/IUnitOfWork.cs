namespace backend.Modules.Concurrency.UseCases.Versioning;

public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
