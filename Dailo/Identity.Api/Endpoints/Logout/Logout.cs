using Identity.Api.CookieOptions;
using Identity.Application.Features.Logout;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SharedKernel.Cookie;

namespace Identity.Api.Endpoints.Logout;

internal static class Logout
{
    internal static IEndpointConventionBuilder MapLogoutEndpoint(this IEndpointRouteBuilder app)
    {
        return app.MapPost(
                "/logout",
                async (
                    ISender sender,
                    ICookieService cookieService,
                    CancellationToken cancellationToken
                ) => await HandleAsync(sender, cookieService, cancellationToken)
            )
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .RequireAuthorization()
            .WithTags(nameof(Identity))
            .WithName("Logout")
            .WithDescription("Invalidates the current refresh token and clears the session cookie.");
    }

    private static async Task<IResult> HandleAsync(
        ISender sender,
        ICookieService cookieService,
        CancellationToken cancellationToken = default
    )
    {
        var refreshToken = cookieService.GetCookie(RefreshTokenCookieOptions.CookieName);
        if (refreshToken is null)
        {
            return TypedResults.Unauthorized();
        }

        var result = await sender.Send(new LogoutCommand(refreshToken), cancellationToken);
        if (result.IsFailure)
        {
            return result.ToTypedHttpResult();
        }

        cookieService.DeleteCookie(RefreshTokenCookieOptions.CookieName);

        return TypedResults.NoContent();
    }
}
