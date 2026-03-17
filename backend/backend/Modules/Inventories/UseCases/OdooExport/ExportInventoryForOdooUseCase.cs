using System.Security.Cryptography;
using System.Text;
using backend.Modules.Inventories.Domain;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;
using backend.Modules.Inventories.UseCases.GetInventoryEditor;
using backend.Modules.Inventories.UseCases.OdooToken;
using backend.Modules.Inventories.UseCases.Statistics;

namespace backend.Modules.Inventories.UseCases.OdooExport;

public sealed class ExportInventoryForOdooUseCase(
    IInventoryApiTokenRepository inventoryApiTokenRepository,
    IInventoryEditorReadModel inventoryEditorReadModel,
    IGetInventoryStatisticsUseCase getInventoryStatisticsUseCase) : IExportInventoryForOdooUseCase
{
    private const int SchemaVersion = 1;

    public async Task<ExportInventoryForOdooResult> ExecuteAsync(
        ExportInventoryForOdooQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        cancellationToken.ThrowIfCancellationRequested();

        var plainToken = query.ApiToken?.Trim();
        if (string.IsNullOrWhiteSpace(plainToken))
        {
            throw new OdooExportUnauthorizedException();
        }

        var activeToken = await inventoryApiTokenRepository.GetActiveByHashAsync(
            ComputeTokenHash(plainToken),
            cancellationToken);
        if (activeToken is null)
        {
            throw new OdooExportUnauthorizedException();
        }

        var inventory = await inventoryEditorReadModel.GetAsync(activeToken.InventoryId, cancellationToken);
        if (inventory is null)
        {
            throw new InventoryNotFoundException(activeToken.InventoryId);
        }

        var statistics = await getInventoryStatisticsUseCase.ExecuteAsync(
            new GetInventoryStatisticsQuery(activeToken.InventoryId),
            cancellationToken);

        var fields = inventory.CustomFields
            .Select(field => new OdooExportFieldResult(
                field.Id,
                field.Title,
                ToApiFieldType(field.FieldType),
                field.ShowInTable))
            .ToArray();

        var numericAggregates = statistics.NumericFields
            .Select(statistic => new OdooExportNumericAggregateResult(
                statistic.FieldId,
                statistic.Title,
                statistic.Min,
                statistic.Max,
                statistic.Avg))
            .ToArray();

        var stringAggregates = statistics.StringFields
            .Select(statistic => new OdooExportStringAggregateResult(
                statistic.FieldId,
                statistic.Title,
                statistic.MostFrequentValue,
                statistic.MostFrequentCount))
            .ToArray();

        return new ExportInventoryForOdooResult(
            new OdooExportInventoryResult(
                inventory.Id,
                inventory.Title,
                inventory.CategoryName,
                inventory.IsPublic,
                statistics.UpdatedAt),
            fields,
            new OdooExportAggregatesResult(
                statistics.ItemsCount,
                numericAggregates,
                stringAggregates),
            new OdooExportSourceResult(
                SchemaVersion,
                DateTime.UtcNow));
    }

    private static string ComputeTokenHash(string plainToken)
    {
        var bytes = Encoding.UTF8.GetBytes(plainToken);
        var digest = SHA256.HashData(bytes);
        return Convert.ToHexString(digest).ToLowerInvariant();
    }

    private static string ToApiFieldType(CustomFieldType fieldType)
    {
        return fieldType switch
        {
            CustomFieldType.SingleLine => "single_line",
            CustomFieldType.MultiLine => "multi_line",
            CustomFieldType.Number => "number",
            CustomFieldType.Link => "link",
            CustomFieldType.Bool => "bool",
            _ => throw new ArgumentOutOfRangeException(nameof(fieldType), fieldType, "Unsupported custom field type.")
        };
    }
}
