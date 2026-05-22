using HabitUser.Application.Options;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;
using SharedKernel.User;

namespace HabitUser.Api.Endpoints.StravaOAuth;

internal static class StravaConnect
{
    internal static IEndpointConventionBuilder MapStravaConnectEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapGet(
                "/integrations/strava/connect",
                (
                    ICurrentUserService currentUserService,
                    IDataProtectionProvider dataProtectionProvider,
                    IOptions<StravaOptions> options
                ) =>
                {
                    var opts = options.Value;
                    var protector = dataProtectionProvider.CreateProtector("StravaOAuth");
                    var state = protector.Protect(currentUserService.UserId.ToString());

                    var authUrl =
                        $"https://www.strava.com/oauth/authorize"
                        + $"?client_id={opts.ClientId}"
                        + $"&response_type=code"
                        + $"&redirect_uri={Uri.EscapeDataString(opts.RedirectUri)}"
                        + $"&approval_prompt=auto"
                        + $"&scope=activity:read_all"
                        + $"&state={Uri.EscapeDataString(state)}";

                    return TypedResults.Ok(new { authUrl });
                }
            )
            .RequireAuthorization()
            .WithTags("HabitUser")
            .WithName("StravaConnect");
    }
}
