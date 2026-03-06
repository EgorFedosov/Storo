using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Inventories.Domain;
using backend.Modules.Items.Domain;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace backend.Modules.Items.UseCases.CreateItem;

public sealed class CreateItemUseCase(
    IItemRepository itemRepository,
    ICustomIdGenerationService customIdGenerationService,
    ICustomFieldValidationService customFieldValidationService,
    IUnitOfWork unitOfWork) : ICreateItemUseCase
{
    private const string DuplicateCustomIdConstraintName = "IX_items_inventory_id_custom_id";

    public async Task<ItemResult> ExecuteAsync(
        CreateItemCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        var inventory = await itemRepository.GetInventoryForCreateAsync(command.InventoryId, cancellationToken);
        if (inventory is null)
        {
            throw new ItemInventoryNotFoundException(command.InventoryId);
        }

        if (!CanWriteItems(inventory, command.ActorUserId, command.ActorIsAdmin))
        {
            throw new CreateItemAccessDeniedException(command.InventoryId, command.ActorUserId);
        }

        var activeFields = inventory.CustomFields
            .Where(static field => field.IsEnabled)
            .OrderBy(static field => field.SortOrder)
            .ThenBy(static field => field.Id)
            .ToArray();

        var nowUtc = DateTime.UtcNow;
        var customId = customIdGenerationService.ResolveCustomId(inventory, command.CustomId, nowUtc);
        var validatedFields = customFieldValidationService.ValidateForCreate(command.Fields, activeFields);

        var item = new Item
        {
            InventoryId = inventory.Id,
            CustomId = customId,
            CreatedByUserId = command.ActorUserId,
            UpdatedByUserId = command.ActorUserId,
            Version = 1,
            CreatedAt = nowUtc,
            UpdatedAt = nowUtc
        };

        foreach (var value in validatedFields.Where(static value => value.HasAnyValue))
        {
            item.CustomFieldValues.Add(new ItemCustomFieldValue
            {
                CustomFieldId = value.FieldId,
                StringValue = value.StringValue,
                TextValue = value.TextValue,
                NumberValue = value.NumberValue,
                LinkValue = value.LinkValue,
                BoolValue = value.BoolValue,
                CreatedAt = nowUtc,
                UpdatedAt = nowUtc
            });
        }

        await itemRepository.AddAsync(item, cancellationToken);

        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsDuplicateCustomIdConstraintViolation(exception))
        {
            throw new ItemCustomIdConflictException(command.InventoryId, customId);
        }

        var actor = await itemRepository.GetUserSummaryAsync(command.ActorUserId, cancellationToken)
                    ?? throw new InvalidOperationException(
                        $"User '{command.ActorUserId}' could not be loaded after item creation.");

        var valueLookup = validatedFields.ToDictionary(static value => value.FieldId);
        var fieldResults = activeFields
            .Select(field =>
            {
                valueLookup.TryGetValue(field.Id, out var validatedFieldValue);
                return new ItemFieldResult(
                    field.Id,
                    field.FieldType,
                    field.Title,
                    field.Description,
                    MapResponseValue(validatedFieldValue));
            })
            .ToArray();

        return new ItemResult(
            item.Id,
            new ItemInventoryResult(inventory.Id, inventory.Title),
            item.CustomId,
            item.Version,
            new ItemFixedFieldsResult(
                item.CreatedAt,
                item.UpdatedAt,
                actor,
                actor),
            fieldResults,
            new ItemLikeResult(0, false),
            new ItemPermissionsResult(
                CanEdit: true,
                CanDelete: true,
                CanLike: true));
    }

    private static bool CanWriteItems(Inventory inventory, long actorUserId, bool actorIsAdmin)
    {
        ArgumentNullException.ThrowIfNull(inventory);

        if (actorIsAdmin || inventory.CreatorId == actorUserId || inventory.IsPublic)
        {
            return true;
        }

        return inventory.AccessList.Any(access => access.UserId == actorUserId);
    }

    private static object? MapResponseValue(ValidatedItemFieldValue? value)
    {
        if (value is null)
        {
            return null;
        }

        if (value.StringValue is not null)
        {
            return value.StringValue;
        }

        if (value.TextValue is not null)
        {
            return value.TextValue;
        }

        if (value.NumberValue.HasValue)
        {
            return value.NumberValue.Value;
        }

        if (value.LinkValue is not null)
        {
            return value.LinkValue;
        }

        if (value.BoolValue.HasValue)
        {
            return value.BoolValue.Value;
        }

        return null;
    }

    private static bool IsDuplicateCustomIdConstraintViolation(DbUpdateException exception)
    {
        if (exception.InnerException is not PostgresException postgresException)
        {
            return false;
        }

        return postgresException.SqlState == PostgresErrorCodes.UniqueViolation
               && string.Equals(
                   postgresException.ConstraintName,
                   DuplicateCustomIdConstraintName,
                   StringComparison.OrdinalIgnoreCase);
    }
}
