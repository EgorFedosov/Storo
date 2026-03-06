namespace backend.Modules.Systems.UseCases.Home;

public interface IHomeReadModel
{
    Task<HomePageDataResult> GetHomePageDataAsync(
        GetHomePageDataQuery query,
        CancellationToken cancellationToken);
}
