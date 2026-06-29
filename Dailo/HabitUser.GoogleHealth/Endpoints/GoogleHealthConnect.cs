using HabitUser.GoogleHealth.Options;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;
using SharedKernel.User;

namespace HabitUser.GoogleHealth.Endpoints;

internal static class GoogleHealthConnect
{
    internal static IEndpointConventionBuilder MapGoogleHealthConnectEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapGet(
                "/integrations/google-health/connect",
                (
                    ICurrentUserService currentUserService,
                    IDataProtectionProvider dataProtectionProvider,
                    IOptions<GoogleHealthOptions> options
                ) =>
                {
                    var opts = options.Value;
                    var protector = dataProtectionProvider.CreateProtector("GoogleHealthOAuth");
                    var state = protector.Protect(currentUserService.UserId.ToString());

                    var authUrl =
                        $"https://accounts.google.com/o/oauth2/v2/auth"
                        + $"?client_id={opts.ClientId}"
                        + $"&response_type=code"
                        + $"&redirect_uri={Uri.EscapeDataString(opts.RedirectUri)}"
                        + $"&scope={Uri.EscapeDataString("https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly")}"
                        + $"&access_type=offline"
                        + $"&prompt=consent"
                        + $"&state={Uri.EscapeDataString(state)}";

                    return TypedResults.Ok(new { authUrl });
                }
            )
            .RequireAuthorization()
            .WithTags("HabitUser")
            .WithName("GoogleHealthConnect");
    }
}
