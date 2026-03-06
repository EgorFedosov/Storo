namespace backend.Modules.Search.UseCases.GetTagCloud;

public interface IGetTagCloudUseCase
{
    Task<TagCloudResult> ExecuteAsync(
        GetTagCloudQuery query,
        CancellationToken cancellationToken);
}
