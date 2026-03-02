namespace backend.Modules.Auth.UseCases.ExternalLogin;

public sealed record StartGoogleLoginCommand(string? ReturnUrl);
