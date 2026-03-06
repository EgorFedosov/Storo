using System.Globalization;
using backend.Modules.Inventories.UseCases.Statistics;

namespace backend.Modules.Inventories.Api;

public sealed record InventoryStatisticsResponse(
    string InventoryId,
    DateTime UpdatedAt,
    int ItemsCount,
    IReadOnlyList<InventoryNumericFieldStatisticsResponse> NumericFields,
    IReadOnlyList<InventoryStringFieldStatisticsResponse> StringFields)
{
    public static InventoryStatisticsResponse FromResult(InventoryStatisticsResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new InventoryStatisticsResponse(
            result.InventoryId.ToString(CultureInfo.InvariantCulture),
            result.UpdatedAt,
            result.ItemsCount,
            result.NumericFields
                .Select(InventoryNumericFieldStatisticsResponse.FromResult)
                .ToArray(),
            result.StringFields
                .Select(InventoryStringFieldStatisticsResponse.FromResult)
                .ToArray());
    }
}

public sealed record InventoryNumericFieldStatisticsResponse(
    string FieldId,
    string Title,
    decimal? Min,
    decimal? Max,
    decimal? Avg)
{
    public static InventoryNumericFieldStatisticsResponse FromResult(InventoryNumericFieldStatisticsResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new InventoryNumericFieldStatisticsResponse(
            result.FieldId.ToString(CultureInfo.InvariantCulture),
            result.Title,
            result.Min,
            result.Max,
            result.Avg);
    }
}

public sealed record InventoryStringFieldStatisticsResponse(
    string FieldId,
    string Title,
    string? MostFrequentValue,
    int MostFrequentCount)
{
    public static InventoryStringFieldStatisticsResponse FromResult(InventoryStringFieldStatisticsResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new InventoryStringFieldStatisticsResponse(
            result.FieldId.ToString(CultureInfo.InvariantCulture),
            result.Title,
            result.MostFrequentValue,
            result.MostFrequentCount);
    }
}
