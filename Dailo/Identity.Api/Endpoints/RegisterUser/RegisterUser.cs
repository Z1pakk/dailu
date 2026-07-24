using Identity.Api.CookieOptions;
using Identity.Application.Features.RegisterUser;
using Identity.Application.Models;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SharedKernel.Cookie;

namespace Identity.Api.Endpoints.RegisterUser;

internal sealed record RegisterUserResponse(AccessTokenModel AccessTokens);

internal static class RegisterUser
{
    internal static IEndpointConventionBuilder MapRegisterEndpoint(this IEndpointRouteBuilder app)
    {
        return app.MapPost(
                "/register",
                async (
                    RegisterUserCommand payload,
                    ISender sender,
                    ICookieService cookieService,
                    IWebHostEnvironment env,
                    CancellationToken cancellationToken
                ) => await HandleAsync(payload, sender, cookieService, env, cancellationToken)
            )
            .Produces<RegisterUserResponse>(StatusCodes.Status201Created)
            .AllowAnonymous()
            .WithTags(nameof(Identity))
            .WithName("RegisterUser")
            .WithDescription(
                "Registers a new user with the provided email, password, first name, and last name. Returns access tokens upon successful registration."
            );
    }

    private static async Task<IResult> HandleAsync(
        RegisterUserCommand request,
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

        var response = new RegisterUserResponse(commandResult.Value.AccessTokens);

        cookieService.SetCookie(
            RefreshTokenCookieOptions.CookieName,
            response.AccessTokens.RefreshToken,
            RefreshTokenCookieOptions.Create(env, response.AccessTokens.RefreshTokenExpiration)
        );

        return TypedResults.Ok(response);
    }
}
