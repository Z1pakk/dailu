using Identity.Api.CookieOptions;
using Identity.Application.Features.Refresh;
using Identity.Application.Models;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SharedKernel.Cookie;

namespace Identity.Api.Endpoints.Refresh;

internal sealed record RefreshResponse(AccessTokenModel AccessTokens);

internal static class Refresh
{
    internal static IEndpointConventionBuilder MapRefreshEndpoint(this IEndpointRouteBuilder app)
    {
        return app.MapPost(
                "/refresh",
                async (
                    RefreshCommand? payload,
                    ISender sender,
                    ICookieService cookieService,
                    IWebHostEnvironment env,
                    CancellationToken cancellationToken
                ) => await HandleAsync(payload, sender, cookieService, env, cancellationToken)
            )
            .Produces<RefreshResponse>()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .AllowAnonymous()
            .WithTags(nameof(Identity))
            .WithName("Refresh")
            .WithDescription(
                "Refreshes the access token using a valid refresh token. Returns new access and refresh tokens if the provided refresh token is valid."
            );
    }

    private static async Task<IResult> HandleAsync(
        RefreshCommand? request,
        ISender sender,
        ICookieService cookieService,
        IWebHostEnvironment env,
        CancellationToken cancellationToken = default
    )
    {
        var requestRefreshToken =
            cookieService.GetCookie(RefreshTokenCookieOptions.CookieName) ?? request?.RefreshToken;
        if (requestRefreshToken is null)
        {
            return TypedResults.Unauthorized();
        }

        var commandResult = await sender.Send(
            new RefreshCommand(requestRefreshToken),
            cancellationToken
        );
        if (commandResult.IsFailure)
        {
            return commandResult.ToTypedHttpResult();
        }

        var response = new RefreshResponse(commandResult.Value.AccessTokens);

        cookieService.SetCookie(
            RefreshTokenCookieOptions.CookieName,
            response.AccessTokens.RefreshToken,
            RefreshTokenCookieOptions.Create(env, response.AccessTokens.RefreshTokenExpiration)
        );

        return TypedResults.Ok(response);
    }
}
