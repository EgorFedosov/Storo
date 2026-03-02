namespace backend.Modules.Auth.Infrastructure;

public sealed class AuthRedirectOptions
{
    public const string SectionName = "Auth:Redirects";

    public string SuccessPath { get; set; } = "/";
    public string ErrorPath { get; set; } = "/auth/error";
}
