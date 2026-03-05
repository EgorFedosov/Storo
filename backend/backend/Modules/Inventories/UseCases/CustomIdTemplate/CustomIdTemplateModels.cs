using backend.Modules.Inventories.Domain;

namespace backend.Modules.Inventories.UseCases.CustomIdTemplate;

public sealed record CustomIdTemplatePartInput(
    CustomIdPartType PartType,
    string? FixedText,
    string? FormatPattern);

public sealed record CustomIdTemplateResult(
    int Version,
    bool IsEnabled,
    IReadOnlyList<CustomIdTemplatePartResult> Parts,
    string? DerivedValidationRegex,
    CustomIdTemplatePreviewResult Preview);

public sealed record CustomIdTemplatePartResult(
    CustomIdPartType PartType,
    string? FixedText,
    string? FormatPattern);

public sealed record CustomIdTemplatePreviewResult(
    string SampleCustomId,
    IReadOnlyList<string> Warnings);

public sealed record CustomIdTemplateComputationResult(
    string? DerivedValidationRegex,
    string SampleCustomId,
    IReadOnlyList<string> Warnings);
