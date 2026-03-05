using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Inventories.Domain;
using backend.Modules.Inventories.UseCases.Abstractions;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;

namespace backend.Modules.Inventories.UseCases.CustomIdTemplate;

public sealed class ReplaceCustomIdTemplateUseCase(
    IInventoryRepository inventoryRepository,
    ICustomIdTemplateService customIdTemplateService,
    ISequenceStateRepository sequenceStateRepository,
    IVersionedCommandUseCase versionedCommandUseCase) : IReplaceCustomIdTemplateUseCase
{
    public async Task<CustomIdTemplateResult> ExecuteAsync(
        ReplaceCustomIdTemplateCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        var inventory = await inventoryRepository.GetForUpdateAsync(command.InventoryId, cancellationToken);
        if (inventory is null)
        {
            throw new InventoryNotFoundException(command.InventoryId);
        }

        if (!command.ActorIsAdmin && inventory.CreatorId != command.ActorUserId)
        {
            throw new InventoryCustomIdTemplateAccessDeniedException(command.InventoryId, command.ActorUserId);
        }

        var now = DateTime.UtcNow;
        var sequenceLastValue = await sequenceStateRepository.GetLastValueAsync(command.InventoryId, cancellationToken);
        var computation = customIdTemplateService.Compute(command.Parts, sequenceLastValue);

        var template = inventory.CustomIdTemplate;
        if (template is null)
        {
            template = new backend.Modules.Inventories.Domain.CustomIdTemplate
            {
                InventoryId = inventory.Id,
                CreatedAt = now
            };

            inventory.CustomIdTemplate = template;
        }

        template.IsEnabled = command.IsEnabled;
        template.ValidationRegex = computation.DerivedValidationRegex;
        template.UpdatedAt = now;

        template.Parts.Clear();
        for (var i = 0; i < command.Parts.Count; i++)
        {
            var part = command.Parts[i];
            template.Parts.Add(new CustomIdTemplatePart
            {
                SortOrder = i + 1,
                PartType = part.PartType,
                FixedText = part.FixedText,
                FormatPattern = part.FormatPattern
            });
        }

        var versionedResult = await versionedCommandUseCase.ExecuteAsync(
            new VersionedCommand(command.IfMatchToken),
            inventory.Version,
            nextVersion =>
            {
                inventory.Version = nextVersion;
                inventory.UpdatedAt = now;
            },
            cancellationToken);

        return new CustomIdTemplateResult(
            versionedResult.Version,
            command.IsEnabled,
            command.Parts
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
