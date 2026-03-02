namespace backend.Modules.Auth.UseCases.AuthProviders;

public interface IAuthProviderRegistry
{
    IReadOnlyCollection<string> GetEnabledProviders();
}
