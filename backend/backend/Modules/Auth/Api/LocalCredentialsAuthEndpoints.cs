using backend.Modules.Auth.UseCases.LocalAuth;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace backend.Modules.Auth.Api;

public static class LocalCredentialsAuthEndpoints
{
    private const int MinLoginLength = 3;
    private const int MaxLoginLength = 100;
    private const int MinPasswordLength = 8;
    private const int MaxPasswordLength = 200;

    public static void MapLocalCredentialsAuthEndpoints(this RouteGroupBuilder apiGroup)
    {
        apiGroup
            .MapPost(
                "/auth/login",
                LoginAsync)
            .WithName("LoginWithPassword")
            .AllowAnonymous()
            .WithMetadata(new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest));

        apiGroup
            .MapPost(
                "/auth/register",
                RegisterAsync)
            .WithName("RegisterWithPassword")
            .AllowAnonymous()
            .WithMetadata(new ProducesResponseTypeAttribute(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest));
    }

    private static async Task<Results<NoContent, ValidationProblem, ProblemHttpResult>> LoginAsync(
        LocalLoginRequest request,
        ILoginWithPasswordUseCase useCase,
        CancellationToken cancellationToken)
    {
        var errors = ValidateLoginRequest(request);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var command = new LoginWithPasswordCommand(request.Login!.Trim(), request.Password!);
        var result = await useCase.ExecuteAsync(command, cancellationToken);

        return result.Status switch
        {
            LocalAuthStatus.Succeeded => TypedResults.NoContent(),
            LocalAuthStatus.UserBlocked => TypedResults.Problem(
                statusCode: StatusCodes.Status403Forbidden,
                title: "User is blocked",
                detail: "The account is blocked and cannot sign in."),
            _ => TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["credentials"] = ["Invalid login or password."]
            })
        };
    }

    private static async Task<Results<NoContent, ValidationProblem, ProblemHttpResult>> RegisterAsync(
        LocalRegisterRequest request,
        IRegisterWithPasswordUseCase useCase,
        CancellationToken cancellationToken)
    {
        var errors = ValidateRegisterRequest(request);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var command = new RegisterWithPasswordCommand(request.Login!.Trim(), request.Password!);
        var result = await useCase.ExecuteAsync(command, cancellationToken);

        return result.Status switch
        {
            LocalAuthStatus.Succeeded => TypedResults.NoContent(),
            LocalAuthStatus.LoginAlreadyTaken => TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["login"] = ["Login is already taken."]
            }),
            _ => TypedResults.Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Registration failed",
                detail: "Unable to create an account with provided credentials.")
        };
    }

    private static Dictionary<string, string[]> ValidateLoginRequest(LocalLoginRequest request)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);

        if (string.IsNullOrWhiteSpace(request.Login))
        {
            errors["login"] = ["Login is required."];
        }
        else
        {
            var trimmedLogin = request.Login.Trim();
            if (trimmedLogin.Length < MinLoginLength || trimmedLogin.Length > MaxLoginLength)
            {
                errors["login"] = [$"Login must be between {MinLoginLength} and {MaxLoginLength} characters."];
            }
        }

        if (string.IsNullOrEmpty(request.Password))
        {
            errors["password"] = ["Password is required."];
        }
        else if (request.Password.Length < MinPasswordLength || request.Password.Length > MaxPasswordLength)
        {
            errors["password"] = [$"Password must be between {MinPasswordLength} and {MaxPasswordLength} characters."];
        }

        return errors;
    }

    private static Dictionary<string, string[]> ValidateRegisterRequest(LocalRegisterRequest request)
    {
        var errors = ValidateLoginRequest(new LocalLoginRequest(request.Login, request.Password));

        if (string.IsNullOrEmpty(request.ConfirmPassword))
        {
            errors["confirmPassword"] = ["Password confirmation is required."];
        }
        else if (!string.Equals(request.Password, request.ConfirmPassword, StringComparison.Ordinal))
        {
            errors["confirmPassword"] = ["Passwords do not match."];
        }

        return errors;
    }
}

public sealed record LocalLoginRequest(
    string? Login,
    string? Password);

public sealed record LocalRegisterRequest(
    string? Login,
    string? Password,
    string? ConfirmPassword);
