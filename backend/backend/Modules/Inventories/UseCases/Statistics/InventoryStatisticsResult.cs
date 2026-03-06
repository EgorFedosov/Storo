namespace backend.Modules.Inventories.UseCases.Statistics;

public sealed record InventoryStatisticsResult(
    long InventoryId,
    DateTime UpdatedAt,
    int ItemsCount,
    IReadOnlyList<InventoryNumericFieldStatisticsResult> NumericFields,
    IReadOnlyList<InventoryStringFieldStatisticsResult> StringFields);

public sealed record InventoryNumericFieldStatisticsResult(
    long FieldId,
    string Title,
    decimal? Min,
    decimal? Max,
    decimal? Avg);

public sealed record InventoryStringFieldStatisticsResult(
    long FieldId,
    string Title,
    string? MostFrequentValue,
    int MostFrequentCount);
