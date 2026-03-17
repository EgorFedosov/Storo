namespace backend.Modules.Inventories.UseCases.OdooExport;

public sealed record ExportInventoryForOdooResult(
    OdooExportInventoryResult Inventory,
    IReadOnlyList<OdooExportFieldResult> Fields,
    OdooExportAggregatesResult Aggregates,
    OdooExportSourceResult Source);

public sealed record OdooExportInventoryResult(
    long Id,
    string Title,
    string Category,
    bool IsPublic,
    DateTime UpdatedAt);

public sealed record OdooExportFieldResult(
    long FieldId,
    string Title,
    string Type,
    bool ShowInTable);

public sealed record OdooExportAggregatesResult(
    int ItemsCount,
    IReadOnlyList<OdooExportNumericAggregateResult> Numeric,
    IReadOnlyList<OdooExportStringAggregateResult> String);

public sealed record OdooExportNumericAggregateResult(
    long FieldId,
    string Title,
    decimal? Min,
    decimal? Max,
    decimal? Avg);

public sealed record OdooExportStringAggregateResult(
    long FieldId,
    string Title,
    string? MostFrequentValue,
    int MostFrequentCount);

public sealed record OdooExportSourceResult(
    int SchemaVersion,
    DateTime GeneratedAt);
