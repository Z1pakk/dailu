using HabitUser.Application.Features.GetIntegrationConfigs;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace HabitUser.Api.Endpoints.GetIntegrationConfigs;

internal sealed record GetIntegrationConfigsResponse(IReadOnlyList<IntegrationSummary> Summaries);

internal static class GetIntegrationConfigs
{
    internal static IEndpointConventionBuilder MapGetIntegrationConfigsEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapGet(
                "/integrations",
                async (ISender sender, CancellationToken cancellationToken) =>
                    await HandleAsync(sender, cancellationToken)
            )
            .Produces<GetIntegrationConfigsResponse>(StatusCodes.Status200OK)
            .RequireAuthorization()
            .WithTags("HabitUser")
            .WithName("GetIntegrationConfigs")
            .WithDescription("Get integration summaries for the current authenticated user.");
    }

    private static async Task<IResult> HandleAsync(
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        var result = await sender.Send(new GetIntegrationConfigsQuery(), cancellationToken);

        if (result.IsFailure)
        {
            return result.ToTypedHttpResult();
        }

        return TypedResults.Ok(new GetIntegrationConfigsResponse(result.Value!.Summaries));
    }
}
