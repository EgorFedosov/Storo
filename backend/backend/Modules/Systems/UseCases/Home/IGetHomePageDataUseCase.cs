namespace backend.Modules.Systems.UseCases.Home;

public interface IGetHomePageDataUseCase
{
    Task<HomePageDataResult> ExecuteAsync(
        GetHomePageDataQuery query,
        CancellationToken cancellationToken);
}
