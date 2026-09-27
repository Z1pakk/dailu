using System.Text.Json;
using HabitUser.Application.Features.Integration.Models;
using HabitUser.Application.Features.Integration.SyncLogs;
using HabitUser.Domain.Entities;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace HabitUser.Api.Endpoints.GetIntegrationSyncLogs;

internal sealed record GetIntegrationSyncLogsResponse(IReadOnlyList<IntegrationSyncLogModel> Logs);

internal static class GetIntegrationSyncLogs
{
    internal static IEndpointConventionBuilder MapGetIntegrationSyncLogsEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapGet(
                "/integrations/{provider}/sync-logs",
                async (
                    string provider,
                    int? take,
                    ISender sender,
                    CancellationToken cancellationToken
                ) => await HandleAsync(provider, take, sender, cancellationToken)
            )
            .Produces<GetIntegrationSyncLogsResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .RequireAuthorization()
            .WithTags("HabitUser")
            .WithName("GetIntegrationSyncLogs")
            .WithDescription(
                "Get the most recent sync log entries of an integration for the current authenticated user."
            );
    }

    private static async Task<IResult> HandleAsync(
        string provider,
        int? take,
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        IntegrationProvider parsedProvider;
        try
        {
            parsedProvider = JsonSerializer.Deserialize<IntegrationProvider>(
                JsonSerializer.Serialize(provider)
            );
        }
        catch (JsonException)
        {
            return TypedResults.Problem(
                title: "Invalid provider",
                detail: $"'{provider}' is not a valid integration provider.",
                statusCode: StatusCodes.Status400BadRequest
            );
        }

        var result = await sender.Send(
            new GetIntegrationSyncLogsQuery(
                parsedProvider,
                take ?? GetIntegrationSyncLogsQuery.DefaultTake
            ),
            cancellationToken
        );

        if (result.IsFailure)
        {
            return result.ToTypedHttpResult();
        }

        return TypedResults.Ok(new GetIntegrationSyncLogsResponse(result.Value.Logs));
    }
}
