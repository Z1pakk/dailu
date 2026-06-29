using HabitUser.GoogleHealth.Models;
using HabitUser.GoogleHealth.Queries;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace HabitUser.GoogleHealth.Endpoints;

internal sealed record GetGoogleHealthProfileResponse(GoogleHealthUserProfileModel Profile);

internal static class GetGoogleHealthProfile
{
    internal static IEndpointConventionBuilder MapGetGoogleHealthProfileEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapGet(
                "/integrations/google-health/profile",
                async (ISender sender, CancellationToken cancellationToken) =>
                    await HandleAsync(sender, cancellationToken)
            )
            .Produces<GetGoogleHealthProfileResponse>(StatusCodes.Status200OK)
            .RequireAuthorization()
            .WithTags("HabitUser")
            .WithName("GetGoogleHealthProfile")
            .WithDescription("Get the Google Health profile for the current authenticated user.");
    }

    private static async Task<IResult> HandleAsync(
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        var result = await sender.Send(new GetGoogleHealthProfileQuery(), cancellationToken);

        if (result.IsFailure)
        {
            return result.ToTypedHttpResult();
        }

        return TypedResults.Ok(new GetGoogleHealthProfileResponse(result.Value!.Profile));
    }
}
