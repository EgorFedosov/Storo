using backend.Modules.Search.UseCases.Abstractions;

namespace backend.Modules.Search.UseCases.GetTagCloud;

public sealed class GetTagCloudUseCase(ITagReadModel tagReadModel) : IGetTagCloudUseCase
{
    public async Task<TagCloudResult> ExecuteAsync(
        GetTagCloudQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var items = await tagReadModel.GetTagCloudAsync(query, cancellationToken);
        return new TagCloudResult(items);
    }
}
