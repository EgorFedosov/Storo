namespace backend.Modules.Auth.UseCases.ExternalLogin;

public sealed record CompleteGitHubLoginCommand(
    string? State,
    string? Code,
    string? Error,
    string? ErrorDescription,
    string? ReturnUrl);
