namespace backend.Modules.Auth.UseCases.LocalAuth;

public sealed record LoginWithPasswordCommand(
    string Login,
    string Password);
