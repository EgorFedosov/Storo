namespace backend.Modules.Inventories.UseCases.OdooToken;

public interface IGenerateInventoryApiTokenUseCase
{
    Task<GenerateInventoryApiTokenResult> ExecuteAsync(
        GenerateInventoryApiTokenCommand command,
        CancellationToken cancellationToken);
}
