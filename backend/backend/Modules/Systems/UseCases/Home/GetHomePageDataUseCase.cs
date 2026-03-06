namespace backend.Modules.Systems.UseCases.Home;

public sealed class GetHomePageDataUseCase(IHomeReadModel homeReadModel) : IGetHomePageDataUseCase
{
    public Task<HomePageDataResult> ExecuteAsync(
        GetHomePageDataQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        return homeReadModel.GetHomePageDataAsync(query, cancellationToken);
    }
}
