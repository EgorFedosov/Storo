namespace backend.Modules.Auth.UseCases.Authorization;

public interface ICurrentUserAccessor
{
    CurrentUser CurrentUser { get; }
}
