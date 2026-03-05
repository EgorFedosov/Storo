namespace backend.Modules.Inventories.UseCases.CustomIdTemplate;

public interface IPreviewCustomIdTemplateUseCase
{
    Task<CustomIdTemplateResult> ExecuteAsync(
        PreviewCustomIdTemplateQuery query,
        CancellationToken cancellationToken);
}
