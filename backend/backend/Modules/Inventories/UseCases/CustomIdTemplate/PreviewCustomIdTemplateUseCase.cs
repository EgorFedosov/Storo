using backend.Modules.Inventories.UseCases.Abstractions;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;

namespace backend.Modules.Inventories.UseCases.CustomIdTemplate;

public sealed class PreviewCustomIdTemplateUseCase(
    IInventoryRepository inventoryRepository,
    ICustomIdTemplateService customIdTemplateService,
    ISequenceStateRepository sequenceStateRepository) : IPreviewCustomIdTemplateUseCase
{
    public async Task<CustomIdTemplateResult> ExecuteAsync(
        PreviewCustomIdTemplateQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var inventory = await inventoryRepository.GetForUpdateAsync(query.InventoryId, cancellationToken);
        if (inventory is null)
        {
            throw new InventoryNotFoundException(query.InventoryId);
        }

        if (!query.ActorIsAdmin && inventory.CreatorId != query.ActorUserId)
        {
            throw new InventoryCustomIdTemplateAccessDeniedException(query.InventoryId, query.ActorUserId);
        }

        var sequenceLastValue = await sequenceStateRepository.GetLastValueAsync(query.InventoryId, cancellationToken);
        var computation = customIdTemplateService.Compute(query.Parts, sequenceLastValue);

        return new CustomIdTemplateResult(
            inventory.Version,
            query.IsEnabled,
            query.Parts
                .Select(part => new CustomIdTemplatePartResult(
                    part.PartType,
                    part.FixedText,
                    part.FormatPattern))
                .ToArray(),
            computation.DerivedValidationRegex,
            new CustomIdTemplatePreviewResult(
                computation.SampleCustomId,
                computation.Warnings));
    }
}
