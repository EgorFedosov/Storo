using System.Text.RegularExpressions;
using backend.Modules.Concurrency.UseCases.Versioning;
using backend.Modules.Inventories.Domain;
using backend.Modules.Items.Domain;
using backend.Modules.Items.UseCases.CreateItem;
using backend.Modules.Items.UseCases.ItemLifecycle;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace backend.Modules.Items.UseCases.UpdateItem;

public sealed class UpdateItemUseCase(
    IItemRepository itemRepository,
    ICustomFieldValidationService customFieldValidationService,
    IUnitOfWork unitOfWork) : IUpdateItemUseCase
{
    private const string DuplicateCustomIdConstraintName = "IX_items_inventory_id_custom_id";
    private const int MaxCustomIdLength = 500;
    private static readonly TimeSpan RegexMatchTimeout = TimeSpan.FromMilliseconds(250);

    public async Task<ItemResult> ExecuteAsync(
        UpdateItemCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        cancellationToken.ThrowIfCancellationRequested();

        var item = await itemRepository.GetForUpdateAsync(command.ItemId, cancellationToken);
        if (item is null)
        {
            throw new ItemNotFoundException(command.ItemId);
        }

        if (!CanWriteItems(item.Inventory, command.ActorUserId, command.ActorIsAdmin))
        {
            throw new ItemWriteAccessDeniedException(item.Id, item.InventoryId, command.ActorUserId);
        }

        if (command.IfMatchToken.Version != item.Version)
        {
            throw new ConcurrencyConflictException(command.IfMatchToken.Version, item.Version);
        }

        EnsureValidCustomId(command.CustomId, item.Inventory.CustomIdTemplate);

        var activeFields = item.Inventory.CustomFields
            .Where(static field => field.IsEnabled)
            .OrderBy(static field => field.SortOrder)
            .ThenBy(static field => field.Id)
            .ToArray();

        var validatedFields = customFieldValidationService.ValidateForCreate(command.Fields, activeFields);

        var nowUtc = DateTime.UtcNow;
        item.CustomId = command.CustomId;
        item.UpdatedByUserId = command.ActorUserId;
        item.UpdatedAt = nowUtc;
        item.Version = checked(item.Version + 1);

        ApplyFieldValues(item, activeFields, validatedFields, nowUtc);

        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsDuplicateCustomIdConstraintViolation(exception))
        {
            throw new ItemCustomIdConflictException(item.InventoryId, item.CustomId);
        }

        var aggregate = await itemRepository.GetDetailsAsync(item.Id, command.ActorUserId, cancellationToken)
                        ?? throw new InvalidOperationException(
                            $"Item '{item.Id}' could not be loaded after update.");

        return ItemDetailsResultFactory.Create(
            aggregate,
            new ItemViewerContext(
                command.ActorUserId,
                IsAuthenticated: true,
                IsBlocked: false,
                command.ActorIsAdmin));
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

    private static void EnsureValidCustomId(string customId, CustomIdTemplate? template)
    {
        if (string.IsNullOrWhiteSpace(customId))
        {
            throw CreateCustomIdValidationException("customId is required.");
        }

        if (customId.Length > MaxCustomIdLength)
        {
            throw CreateCustomIdValidationException($"customId must be {MaxCustomIdLength} characters or less.");
        }

        if (template is null || !template.IsEnabled || string.IsNullOrWhiteSpace(template.ValidationRegex))
        {
            return;
        }

        var matchesTemplate = TryMatchTemplateRegex(template.ValidationRegex, customId);
        if (!matchesTemplate)
        {
            throw CreateCustomIdValidationException("customId does not match the current custom-id template.");
        }
    }

    private static bool TryMatchTemplateRegex(string templateRegex, string customId)
    {
        try
        {
            return Regex.IsMatch(
                customId,
                templateRegex,
                RegexOptions.CultureInvariant,
                RegexMatchTimeout);
        }
        catch (ArgumentException)
        {
            return false;
        }
    }

    private static void ApplyFieldValues(
        Item item,
        IReadOnlyList<CustomField> activeFields,
        IReadOnlyList<ValidatedItemFieldValue> validatedFields,
        DateTime nowUtc)
    {
        var activeFieldIds = activeFields
            .Select(static field => field.Id)
            .ToHashSet();

        var existingValuesByFieldId = item.CustomFieldValues
            .Where(value => activeFieldIds.Contains(value.CustomFieldId))
            .ToDictionary(value => value.CustomFieldId);

        var validatedByFieldId = validatedFields
            .ToDictionary(static value => value.FieldId);

        foreach (var field in activeFields)
        {
            validatedByFieldId.TryGetValue(field.Id, out var validatedValue);
            var hasValue = validatedValue is { HasAnyValue: true };
            existingValuesByFieldId.TryGetValue(field.Id, out var existingValue);

            if (!hasValue)
            {
                if (existingValue is not null)
                {
                    item.CustomFieldValues.Remove(existingValue);
                }

                continue;
            }

            if (existingValue is null)
            {
                item.CustomFieldValues.Add(CreateValueEntity(field.Id, validatedValue!, nowUtc));
                continue;
            }

            ApplyValue(existingValue, validatedValue!);
            existingValue.UpdatedAt = nowUtc;
        }
    }

    private static ItemCustomFieldValue CreateValueEntity(
        long fieldId,
        ValidatedItemFieldValue value,
        DateTime nowUtc)
    {
        var entity = new ItemCustomFieldValue
        {
            CustomFieldId = fieldId,
            CreatedAt = nowUtc,
            UpdatedAt = nowUtc
        };

        ApplyValue(entity, value);
        return entity;
    }

    private static void ApplyValue(ItemCustomFieldValue entity, ValidatedItemFieldValue value)
    {
        entity.StringValue = value.StringValue;
        entity.TextValue = value.TextValue;
        entity.NumberValue = value.NumberValue;
        entity.LinkValue = value.LinkValue;
        entity.BoolValue = value.BoolValue;
    }

    private static ItemValidationException CreateCustomIdValidationException(string message)
    {
        return new ItemValidationException(new Dictionary<string, string[]>
        {
            ["customId"] = [message]
        });
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
