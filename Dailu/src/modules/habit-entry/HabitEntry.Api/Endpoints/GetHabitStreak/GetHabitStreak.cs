using HabitEntry.Application.Features.GetHabitStreak;
using HabitEntry.Application.Models;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using StrictId;

namespace HabitEntry.Api.Endpoints.GetHabitStreak;

internal static class GetHabitStreak
{
    internal static IEndpointConventionBuilder MapGetHabitStreakEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapGet(
                "/streak/{habitId}",
                async (
                    Id habitId,
                    int days,
                    ISender sender,
                    CancellationToken cancellationToken
                ) => await HandleAsync(habitId, days, sender, cancellationToken)
            )
            .Produces<GetHabitStreakQueryResponse>(StatusCodes.Status200OK)
            .WithTags(nameof(HabitEntryModel))
            .WithName("GetHabitStreak")
            .WithDescription("Gets the current and longest streak for a habit.");
    }

    private static async Task<IResult> HandleAsync(
        Id habitId,
        int days,
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        var queryResult = await sender.Send(
            new GetHabitStreakQuery(habitId, days),
            cancellationToken
        );
        if (queryResult.IsFailure)
        {
            return queryResult.ToTypedHttpResult();
        }

        return TypedResults.Ok(queryResult.Value);
    }
}
