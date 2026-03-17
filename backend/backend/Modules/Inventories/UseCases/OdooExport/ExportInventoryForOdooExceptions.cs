namespace backend.Modules.Inventories.UseCases.OdooExport;

public sealed class OdooExportUnauthorizedException
    : Exception
{
    public OdooExportUnauthorizedException()
        : base("API token is missing, invalid, or inactive.")
    {
    }
}
