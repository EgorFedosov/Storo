namespace backend.Modules.Inventories.Domain;

public enum CustomIdPartType
{
    FixedText = 1,
    Random20Bit = 2,
    Random32Bit = 3,
    Random6Digit = 4,
    Random9Digit = 5,
    Guid = 6,
    DateTime = 7,
    Sequence = 8
}
