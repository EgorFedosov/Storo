namespace backend.Modules.Auth.UseCases.ExternalLogin;

public sealed record StartGitHubLoginCommand(string? ReturnUrl);
