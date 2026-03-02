namespace backend.Modules.Auth.UseCases.ExternalLogin;

public sealed class CompleteGoogleLoginUseCase(
    IExternalAuthService externalAuthService,
    IUserRepository userRepository,
    ISessionService sessionService) : ICompleteGoogleLoginUseCase
{
    public async Task<AuthSessionResult> ExecuteAsync(
        CompleteGoogleLoginCommand command,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        ExternalAuthCallbackResult callbackResult;
        try
        {
            callbackResult = await externalAuthService.CompleteGoogleAuthenticationAsync(command, cancellationToken);
        }
        finally
        {
            await externalAuthService.ClearExternalStateAsync(cancellationToken);
        }

        if (!callbackResult.IsAuthenticated || callbackResult.Identity is null)
        {
            await sessionService.SignOutAsync(cancellationToken);
            return AuthSessionResult.FromRedirect(callbackResult.RedirectUri);
        }

        var user = await userRepository.UpsertExternalUserAsync(callbackResult.Identity, cancellationToken);

        if (user.IsBlocked)
        {
            await sessionService.SignOutAsync(cancellationToken);
            return AuthSessionResult.FromRedirect(
                externalAuthService.BuildErrorRedirectUri(ExternalAuthErrorCodes.UserBlocked));
        }

        await sessionService.SignInAsync(user, cancellationToken);
        return AuthSessionResult.FromRedirect(callbackResult.RedirectUri);
    }
}
