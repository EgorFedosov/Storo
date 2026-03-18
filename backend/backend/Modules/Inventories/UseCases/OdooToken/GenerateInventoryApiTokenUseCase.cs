using System.Security.Cryptography;
using System.Text;
using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Inventories.Domain;
using backend.Modules.Inventories.UseCases.Abstractions;
using backend.Modules.Inventories.UseCases.GetInventoryDetails;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace backend.Modules.Inventories.UseCases.OdooToken;

public sealed class GenerateInventoryApiTokenUseCase(
    IInventoryRepository inventoryRepository,
    IInventoryApiTokenRepository inventoryApiTokenRepository,
    IUnitOfWork unitOfWork) : IGenerateInventoryApiTokenUseCase
{
    private const string TokenPrefix = "odoo_";
    private const string ActiveTokenUniqueIndexName = "IX_inventory_api_tokens_inventory_id_active_unique";

    public async Task<GenerateInventoryApiTokenResult> ExecuteAsync(
        GenerateInventoryApiTokenCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        var inventory = await inventoryRepository.GetForUpdateAsync(command.InventoryId, cancellationToken);
        if (inventory is null)
        {
            throw new InventoryNotFoundException(command.InventoryId);
        }

        if (!CanGenerateToken(inventory, command.ActorUserId, command.ActorIsAdmin))
        {
            throw new InventoryApiTokenGenerationAccessDeniedException(command.InventoryId, command.ActorUserId);
        }

        var nowUtc = DateTime.UtcNow;
        var activeToken = await inventoryApiTokenRepository.GetActiveForUpdateAsync(command.InventoryId, cancellationToken);
        if (activeToken is not null)
        {
            activeToken.IsActive = false;
            activeToken.RevokedAt = nowUtc;
        }

        var plainToken = GeneratePlainToken();
        var tokenHash = ComputeTokenHash(plainToken);
        var newToken = new InventoryApiToken
        {
            InventoryId = command.InventoryId,
            TokenHash = tokenHash,
            IsActive = true,
            CreatedByUserId = command.ActorUserId,
            CreatedAt = nowUtc,
            RevokedAt = null
        };

        await inventoryApiTokenRepository.AddAsync(newToken, cancellationToken);

        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsActiveTokenUniqueConstraintViolation(exception))
        {
            throw new InventoryApiTokenGenerationConflictException(command.InventoryId);
        }

        return new GenerateInventoryApiTokenResult(
            command.InventoryId,
            plainToken,
            CreateMaskedToken(tokenHash),
            nowUtc);
    }

    private static bool CanGenerateToken(Inventory inventory, long actorUserId, bool actorIsAdmin)
    {
        ArgumentNullException.ThrowIfNull(inventory);

        if (actorIsAdmin || inventory.CreatorId == actorUserId)
        {
            return true;
        }

        return inventory.AccessList.Any(access => access.UserId == actorUserId);
    }

    private static string GeneratePlainToken()
    {
        Span<byte> randomBytes = stackalloc byte[24];
        RandomNumberGenerator.Fill(randomBytes);
        return TokenPrefix + Convert.ToHexString(randomBytes).ToLowerInvariant();
    }

    private static string ComputeTokenHash(string plainToken)
    {
        var bytes = Encoding.UTF8.GetBytes(plainToken);
        var digest = SHA256.HashData(bytes);
        return Convert.ToHexString(digest).ToLowerInvariant();
    }

    private static string CreateMaskedToken(string tokenHash)
    {
        var normalizedHash = tokenHash?.Trim() ?? string.Empty;
        if (normalizedHash.Length == 0)
        {
            return $"{TokenPrefix}************";
        }

        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(normalizedHash));
        var suffix = Convert.ToHexString(digest).ToLowerInvariant()[^4..];
        return $"{TokenPrefix}************{suffix}";
    }

    private static bool IsActiveTokenUniqueConstraintViolation(DbUpdateException exception)
    {
        if (exception.InnerException is not PostgresException postgresException)
        {
            return false;
        }

        return postgresException.SqlState == PostgresErrorCodes.UniqueViolation
               && string.Equals(
                   postgresException.ConstraintName,
                   ActiveTokenUniqueIndexName,
                   StringComparison.OrdinalIgnoreCase);
    }
}
