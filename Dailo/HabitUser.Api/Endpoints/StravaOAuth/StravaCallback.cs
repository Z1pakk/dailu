using HabitUser.Application.Features.HandleStravaCallback;
using HabitUser.Application.Options;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;

namespace HabitUser.Api.Endpoints.StravaOAuth;

internal static class StravaCallback
{
    internal static IEndpointConventionBuilder MapStravaCallbackEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapGet(
                "/integrations/strava/callback",
                async (
                    string? code,
                    string? state,
                    ISender sender,
                    IDataProtectionProvider dataProtectionProvider,
                    IOptions<StravaOptions> options,
                    CancellationToken cancellationToken
                ) =>
                {
                    var frontendUrl = options.Value.FrontendCallbackUrl;

                    if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state))
                    {
                        return Results.Redirect($"{frontendUrl}?strava_error=invalid_request");
                    }

                    var protector = dataProtectionProvider.CreateProtector("StravaOAuth");

                    Guid userId;
                    try
                    {
                        userId = Guid.Parse(protector.Unprotect(state));
                    }
                    catch
                    {
                        return Results.Redirect($"{frontendUrl}?strava_error=invalid_state");
                    }

                    var result = await sender.Send(
                        new HandleStravaCallbackCommand(userId, code),
                        cancellationToken
                    );

                    return result.IsSuccess
                        ? Results.Redirect($"{frontendUrl}?strava_connected=true")
                        : Results.Redirect($"{frontendUrl}?strava_error=callback_failed");
                }
            )
            .WithTags("HabitUser")
            .WithName("StravaCallback");
    }
}
