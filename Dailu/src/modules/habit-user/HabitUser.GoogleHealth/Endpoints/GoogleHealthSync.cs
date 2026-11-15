using HabitUser.GoogleHealth.Commands;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace HabitUser.GoogleHealth.Endpoints;

internal static class GoogleHealthSync
{
    internal static IEndpointConventionBuilder MapGoogleHealthSyncEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapPost(
                "/integrations/google-health/sync",
                async (ISender sender, CancellationToken cancellationToken) =>
                {
                    var result = await sender.Send(
                        new SyncGoogleHealthIntegrationCommand(),
                        cancellationToken
                    );

                    return result.ToTypedHttpResult();
                }
            )
            .Produces<SyncGoogleHealthIntegrationCommandResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .RequireAuthorization()
            .WithTags("HabitUser")
            .WithName("SyncGoogleHealth")
            .WithDescription("Sync the current authenticated user's Google Health integration now.");
    }
}
