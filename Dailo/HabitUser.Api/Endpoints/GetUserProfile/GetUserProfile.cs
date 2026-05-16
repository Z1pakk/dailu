using HabitUser.Application.Features.GetUserProfile;
using HabitUser.Application.Models;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace HabitUser.Api.Endpoints.GetUserProfile;

internal sealed record GetUserProfileResponse(UserProfileModel Profile);

internal static class GetUserProfile
{
    internal static IEndpointConventionBuilder MapGetUserProfileEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapGet(
                "/profile",
                async (ISender sender, CancellationToken cancellationToken) =>
                    await HandleAsync(sender, cancellationToken)
            )
            .Produces<GetUserProfileResponse>(StatusCodes.Status200OK)
            .RequireAuthorization()
            .WithTags("HabitUser")
            .WithName("GetUserProfile")
            .WithDescription("Get user profile for the current authenticated user.");
    }

    private static async Task<IResult> HandleAsync(
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        var result = await sender.Send(new GetUserProfileQuery(), cancellationToken);
        if (result.IsFailure)
        {
            return result.ToTypedHttpResult();
        }

        var response = new GetUserProfileResponse(result.Value!.Profile);

        return TypedResults.Ok(response);
    }
}
