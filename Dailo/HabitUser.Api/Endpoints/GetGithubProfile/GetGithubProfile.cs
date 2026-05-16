using HabitUser.Application.Features.GetGithubProfile;
using HabitUser.Application.Models;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace HabitUser.Api.Endpoints.GetGithubProfile;

internal sealed record GetGithubProfileResponse(GitHubUserProfileModel Profile);

internal static class GetGithubProfile
{
    internal static IEndpointConventionBuilder MapGetGithubProfileEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapGet(
                "/integrations/github/profile",
                async (ISender sender, CancellationToken cancellationToken) =>
                    await HandleAsync(sender, cancellationToken)
            )
            .Produces<GetGithubProfileResponse>(StatusCodes.Status200OK)
            .RequireAuthorization()
            .WithTags("HabitUser")
            .WithName("GetGithubProfile")
            .WithDescription("Get the GitHub profile for the current authenticated user.");
    }

    private static async Task<IResult> HandleAsync(
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        var result = await sender.Send(new GetGithubProfileQuery(), cancellationToken);

        if (result.IsFailure)
        {
            return result.ToTypedHttpResult();
        }

        return TypedResults.Ok(new GetGithubProfileResponse(result.Value!.Profile));
    }
}