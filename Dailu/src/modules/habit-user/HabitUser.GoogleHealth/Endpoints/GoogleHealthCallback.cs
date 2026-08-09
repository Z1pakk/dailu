using HabitUser.GoogleHealth.Commands;
using HabitUser.GoogleHealth.Options;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;

namespace HabitUser.GoogleHealth.Endpoints;

internal static class GoogleHealthCallback
{
    internal static IEndpointConventionBuilder MapGoogleHealthCallbackEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapGet(
                "/integrations/google-health/callback",
                async (
                    string? code,
                    string? state,
                    ISender sender,
                    IDataProtectionProvider dataProtectionProvider,
                    IOptions<GoogleHealthOptions> options,
                    CancellationToken cancellationToken
                ) =>
                {
                    var frontendUrl = options.Value.FrontendCallbackUrl;

                    if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state))
                    {
                        return Results.Redirect($"{frontendUrl}?google_health_error=invalid_request");
                    }

                    var protector = dataProtectionProvider.CreateProtector("GoogleHealthOAuth");

                    Guid userId;
                    try
                    {
                        userId = Guid.Parse(protector.Unprotect(state));
                    }
                    catch
                    {
                        return Results.Redirect($"{frontendUrl}?google_health_error=invalid_state");
                    }

                    var result = await sender.Send(
                        new HandleGoogleHealthCallbackCommand(userId, code),
                        cancellationToken
                    );

                    return result.IsSuccess
                        ? Results.Redirect($"{frontendUrl}?google_health_connected=true")
                        : Results.Redirect($"{frontendUrl}?google_health_error=callback_failed");
                }
            )
            .WithTags("HabitUser")
            .WithName("GoogleHealthCallback");
    }
}
