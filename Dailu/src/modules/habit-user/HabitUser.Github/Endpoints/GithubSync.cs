using HabitUser.Github.Commands;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace HabitUser.Github.Endpoints;

internal static class GithubSync
{
    internal static IEndpointConventionBuilder MapGithubSyncEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapPost(
                "/integrations/github/sync",
                async (ISender sender, CancellationToken cancellationToken) =>
                {
                    var result = await sender.Send(
                        new SyncGithubIntegrationCommand(),
                        cancellationToken
                    );

                    return result.ToTypedHttpResult();
                }
            )
            .Produces<SyncGithubIntegrationCommandResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .RequireAuthorization()
            .WithTags("HabitUser")
            .WithName("SyncGithub")
            .WithDescription("Sync the current authenticated user's GitHub integration now.");
    }
}
