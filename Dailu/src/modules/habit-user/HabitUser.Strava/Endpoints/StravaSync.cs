using HabitUser.Strava.Commands;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace HabitUser.Strava.Endpoints;

internal static class StravaSync
{
    internal static IEndpointConventionBuilder MapStravaSyncEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapPost(
                "/integrations/strava/sync",
                async (ISender sender, CancellationToken cancellationToken) =>
                {
                    var result = await sender.Send(
                        new SyncStravaIntegrationCommand(),
                        cancellationToken
                    );

                    return result.ToTypedHttpResult();
                }
            )
            .Produces<SyncStravaIntegrationCommandResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .RequireAuthorization()
            .WithTags("HabitUser")
            .WithName("SyncStrava")
            .WithDescription("Sync the current authenticated user's Strava integration now.");
    }
}
