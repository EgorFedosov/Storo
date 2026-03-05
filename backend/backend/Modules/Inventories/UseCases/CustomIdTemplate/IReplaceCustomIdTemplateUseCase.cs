namespace backend.Modules.Inventories.UseCases.CustomIdTemplate;

public interface IReplaceCustomIdTemplateUseCase
{
    Task<CustomIdTemplateResult> ExecuteAsync(
        ReplaceCustomIdTemplateCommand command,
        CancellationToken cancellationToken);
}
