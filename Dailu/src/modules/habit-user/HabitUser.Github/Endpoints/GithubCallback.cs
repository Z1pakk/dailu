using HabitUser.Github.Commands;
using HabitUser.Github.Options;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;

namespace HabitUser.Github.Endpoints;

internal static class GithubCallback
{
    internal static IEndpointConventionBuilder MapGithubCallbackEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapGet(
                "/integrations/github/callback",
                async (
                    string? code,
                    string? state,
                    ISender sender,
                    IDataProtectionProvider dataProtectionProvider,
                    IOptions<GithubOptions> options,
                    CancellationToken cancellationToken
                ) =>
                {
                    var frontendUrl = options.Value.FrontendCallbackUrl;

                    if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state))
                    {
                        return Results.Redirect($"{frontendUrl}?github_error=invalid_request");
                    }

                    var protector = dataProtectionProvider.CreateProtector("GithubOAuth");

                    Guid userId;
                    try
                    {
                        userId = Guid.Parse(protector.Unprotect(state));
                    }
                    catch
                    {
                        return Results.Redirect($"{frontendUrl}?github_error=invalid_state");
                    }

                    var result = await sender.Send(
                        new HandleGithubCallbackCommand(userId, code),
                        cancellationToken
                    );

                    return result.IsSuccess
                        ? Results.Redirect($"{frontendUrl}?github_connected=true")
                        : Results.Redirect($"{frontendUrl}?github_error=callback_failed");
                }
            )
            .WithTags("HabitUser")
            .WithName("GithubCallback");
    }
}
