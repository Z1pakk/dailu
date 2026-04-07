using Identity.Application.Features.RegisterUser;
using Identity.Application.Models;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

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
                    CancellationToken cancellationToken
                ) => await HandleAsync(payload, sender, cancellationToken)
            )
            .Produces<RegisterUserResponse>(StatusCodes.Status201Created)
            .AllowAnonymous()
            .WithTags(nameof(Identity))
            .WithName("Register user");
    }

    private static async Task<IResult> HandleAsync(
        RegisterUserCommand request,
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        var commandResult = await sender.Send(request, cancellationToken);
        if (commandResult.IsFailure)
        {
            return commandResult.ToTypedHttpResult();
        }

        var response = new RegisterUserResponse(commandResult.Value!.AccessTokens);
        return TypedResults.Ok(response);
    }
}
