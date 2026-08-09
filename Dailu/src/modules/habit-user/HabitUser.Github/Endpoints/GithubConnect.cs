using HabitUser.Github.Options;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;
using SharedKernel.User;

namespace HabitUser.Github.Endpoints;

internal static class GithubConnect
{
    internal static IEndpointConventionBuilder MapGithubConnectEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapGet(
                "/integrations/github/connect",
                (
                    ICurrentUserService currentUserService,
                    IDataProtectionProvider dataProtectionProvider,
                    IOptions<GithubOptions> options
                ) =>
                {
                    var opts = options.Value;
                    var protector = dataProtectionProvider.CreateProtector("GithubOAuth");
                    var state = protector.Protect(currentUserService.UserId.ToString());

                    var authUrl =
                        $"https://github.com/login/oauth/authorize"
                        + $"?client_id={opts.ClientId}"
                        + $"&response_type=code"
                        + $"&redirect_uri={Uri.EscapeDataString(opts.RedirectUri)}"
                        + $"&scope=read:user%20repo"
                        + $"&state={Uri.EscapeDataString(state)}";

                    return TypedResults.Ok(new { authUrl });
                }
            )
            .RequireAuthorization()
            .WithTags("HabitUser")
            .WithName("GithubConnect");
    }
}
