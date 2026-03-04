namespace backend.Modules.Users.UseCases.AdminModeration;

public sealed record BlockUserCommand(long UserId);

public sealed record UnblockUserCommand(long UserId);

public sealed record GrantAdminCommand(long UserId);

public sealed record RevokeAdminCommand(long UserId);

public sealed record DeleteUserCommand(long UserId);
