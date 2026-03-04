namespace backend.Modules.Users.UseCases.AdminModeration;

public sealed record AdminModerationResult(
    long UserId,
    AdminModerationOperationStatus Status,
    bool Changed);

public enum AdminModerationOperationStatus
{
    Blocked = 0,
    Unblocked = 1,
    AdminGranted = 2,
    AdminRevoked = 3
}

public sealed record DeleteUserResult(long UserId);
