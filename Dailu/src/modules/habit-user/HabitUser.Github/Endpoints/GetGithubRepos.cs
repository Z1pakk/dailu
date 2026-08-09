using HabitUser.Github.Models;
using HabitUser.Github.Queries;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace HabitUser.Github.Endpoints;

internal sealed record GetGithubReposResponse(IEnumerable<GitHubRepositoryModel> Repositories);

internal static class GetGithubRepos
{
    internal static IEndpointConventionBuilder MapGetGithubReposEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapGet(
                "/integrations/github/repos",
                async (ISender sender, CancellationToken cancellationToken) =>
                    await HandleAsync(sender, cancellationToken)
            )
            .Produces<GetGithubReposResponse>(StatusCodes.Status200OK)
            .RequireAuthorization()
            .WithTags("HabitUser")
            .WithName("GetGithubRepos")
            .WithDescription("Get the GitHub repositories accessible to the current authenticated user.");
    }

    private static async Task<IResult> HandleAsync(
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        var result = await sender.Send(new GetGithubReposQuery(), cancellationToken);

        if (result.IsFailure)
        {
            return result.ToTypedHttpResult();
        }

        return TypedResults.Ok(new GetGithubReposResponse(result.Value.Repositories));
    }
}
