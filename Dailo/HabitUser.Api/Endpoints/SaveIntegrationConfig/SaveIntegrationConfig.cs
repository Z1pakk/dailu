using HabitUser.Application.Features.SaveIntegrationConfig;
using HabitUser.Domain.Integrations;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SharedKernel.ResultPattern;

namespace HabitUser.Api.Endpoints.SaveIntegrationConfig;

internal static class SaveIntegrationConfig
{
    internal static IEndpointConventionBuilder MapSaveIntegrationConfigEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapPut(
                "/integrations",
                async (
                    IntegrationConfig config,
                    ISender sender,
                    CancellationToken cancellationToken
                ) => await HandleAsync(config, sender, cancellationToken)
            )
            .Produces(StatusCodes.Status204NoContent)
            .RequireAuthorization()
            .WithTags("HabitUser")
            .WithName("SaveIntegrationConfig")
            .WithDescription("Saves integration config for the current authenticated user.");
    }

    private static async Task<IResult> HandleAsync(
        IntegrationConfig config,
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        var result = await sender.Send(
            new SaveIntegrationConfigCommand(config),
            cancellationToken
        );

        if (result.IsFailure)
        {
            return result.ToTypedHttpResult();
        }

        return TypedResults.NoContent();
    }
}
