namespace backend.Modules.Inventories.UseCases.OdooExport;

public interface IExportInventoryForOdooUseCase
{
    Task<ExportInventoryForOdooResult> ExecuteAsync(
        ExportInventoryForOdooQuery query,
        CancellationToken cancellationToken);
}
