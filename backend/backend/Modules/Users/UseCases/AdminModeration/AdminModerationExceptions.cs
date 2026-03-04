namespace backend.Modules.Users.UseCases.AdminModeration;

public sealed class AdminUserNotFoundException(long userId)
    : Exception($"User with id '{userId}' was not found.")
{
    public long UserId { get; } = userId;
}
