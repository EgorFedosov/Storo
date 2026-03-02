namespace backend.Modules.Auth.UseCases.Authorization;

public sealed record AuthorizationCheck(
    string PolicyName,
    object? Resource = null);
