using Identity.Api.CookieOptions;
using Identity.Application.Features.LoginUser;
using Identity.Application.Models;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SharedKernel.Cookie;

namespace Identity.Api.Endpoints.LoginUser;

internal sealed record LoginUserResponse(AccessTokenModel AccessTokens);

internal static class LoginUser
{
    internal static IEndpointConventionBuilder MapLoginEndpoint(this IEndpointRouteBuilder app)
    {
        return app.MapPost(
                "/login",
                async (
                    LoginUserCommand payload,
                    ISender sender,
                    ICookieService cookieService,
                    IWebHostEnvironment env,
                    CancellationToken cancellationToken
                ) => await HandleAsync(payload, sender, cookieService, env, cancellationToken)
            )
            .Produces<LoginUserResponse>()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .AllowAnonymous()
            .WithTags(nameof(Identity))
            .WithName("LoginUser")
            .WithDescription(
                "Login a user with email and password. Returns access and refresh tokens if successful."
            );
    }

    private static async Task<IResult> HandleAsync(
        LoginUserCommand request,
        ISender sender,
        ICookieService cookieService,
        IWebHostEnvironment env,
        CancellationToken cancellationToken = default
    )
    {
        var commandResult = await sender.Send(request, cancellationToken);
        if (commandResult.IsFailure)
        {
            return commandResult.ToTypedHttpResult();
        }

        var response = new LoginUserResponse(commandResult.Value.AccessTokens);

        cookieService.SetCookie(
            RefreshTokenCookieOptions.CookieName,
            response.AccessTokens.RefreshToken,
            RefreshTokenCookieOptions.Create(env, response.AccessTokens.RefreshTokenExpiration)
        );

        return TypedResults.Ok(response);
    }
}
