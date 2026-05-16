using HabitUser.Application.Features.DeleteIntegrationConfig;
using HabitUser.Domain.Entities;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace HabitUser.Api.Endpoints.DeleteIntegrationConfig;

internal static class DeleteIntegrationConfig
{
    internal static IEndpointConventionBuilder MapDeleteIntegrationConfigEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapDelete(
                "/integrations/{provider}",
                async (string provider, ISender sender, CancellationToken cancellationToken) =>
                    await HandleAsync(provider, sender, cancellationToken)
            )
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status400BadRequest)
            .RequireAuthorization()
            .WithTags("HabitUser")
            .WithName("DeleteIntegrationConfig")
            .WithDescription("Revokes an integration config for the current authenticated user.");
    }

    private static async Task<IResult> HandleAsync(
        string provider,
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        if (!Enum.TryParse<IntegrationProvider>(provider, ignoreCase: true, out var parsedProvider))
        {
            return TypedResults.Problem(
                title: "Invalid provider",
                detail: $"'{provider}' is not a valid integration provider.",
                statusCode: StatusCodes.Status400BadRequest
            );
        }

        var result = await sender.Send(
            new DeleteIntegrationConfigCommand(parsedProvider),
            cancellationToken
        );

        if (result.IsFailure)
        {
            return result.ToTypedHttpResult();
        }

        return TypedResults.NoContent();
    }
}
