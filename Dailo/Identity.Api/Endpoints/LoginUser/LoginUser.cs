using Identity.Application.Features.LoginUser;
using Identity.Application.Models;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

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
                    CancellationToken cancellationToken
                ) => await HandleAsync(payload, sender, cancellationToken)
            )
            .Produces<LoginUserResponse>()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .AllowAnonymous()
            .WithTags(nameof(Identity))
            .WithName("Login user");
    }

    private static async Task<IResult> HandleAsync(
        LoginUserCommand request,
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        var commandResult = await sender.Send(request, cancellationToken);
        if (commandResult.IsFailure)
        {
            return commandResult.ToTypedHttpResult();
        }

        var response = new LoginUserResponse(commandResult.Value!.AccessTokens);
        return TypedResults.Ok(response);
    }
}
