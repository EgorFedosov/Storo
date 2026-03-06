namespace backend.Modules.Items.UseCases.CreateItem;

public sealed record CreateItemCommand(
    long InventoryId,
    long ActorUserId,
    bool ActorIsAdmin,
    string? CustomId,
    IReadOnlyList<CreateItemFieldInput> Fields);

public sealed record CreateItemFieldInput(
    int Index,
    long FieldId,
    ItemFieldValueKind ValueKind,
    string? StringValue,
    decimal? NumberValue,
    bool? BoolValue);

public enum ItemFieldValueKind
{
    Null = 1,
    String = 2,
    Number = 3,
    Bool = 4
}
