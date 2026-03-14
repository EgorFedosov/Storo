namespace backend.Modules.Auth.UseCases.LocalAuth;

public sealed record RegisterWithPasswordCommand(
    string Login,
    string Password);
