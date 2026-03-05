namespace backend.Modules.Inventories.UseCases.CustomIdTemplate;

public interface ICustomIdTemplateService
{
    CustomIdTemplateComputationResult Compute(
        IReadOnlyList<CustomIdTemplatePartInput> parts,
        long? sequenceLastValue);
}
