using Identity.Application.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Identity.Api.Endpoints.Altcha;

internal static class GetAltchaChallenge
{
    internal static IEndpointConventionBuilder MapAltchaChallengeEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app
            .MapGet(
                "/altcha-challenge",
                (IAltchaService altchaService) => TypedResults.Ok(altchaService.CreateChallenge())
            )
            .AllowAnonymous()
            .WithTags("Identity")
            .WithName("GetAltchaChallenge")
            .WithDescription("Returns an Altcha proof-of-work challenge for CAPTCHA verification.");
    }
}
