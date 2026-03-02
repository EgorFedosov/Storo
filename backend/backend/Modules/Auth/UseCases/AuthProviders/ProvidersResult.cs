namespace backend.Modules.Auth.UseCases.AuthProviders;

public sealed record ProvidersResult(IReadOnlyCollection<string> Providers);
