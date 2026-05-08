using HabitEntry.Application.Features.GetHabitEntries;
using HabitEntry.Application.Models;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Habit.Api.Endpoints.GetHabitEntries;

internal sealed record GetHabitEntriesResponse(IEnumerable<HabitEntryModel> HabitEntries);

internal static class GetHabitEntries
{
    internal static IEndpointConventionBuilder MapGetHabitEntriesEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapGet(
                "/",
                async (ISender sender, CancellationToken cancellationToken) =>
                    await HandleAsync(sender, cancellationToken)
            )
            .Produces<GetHabitEntriesQueryResponse>(StatusCodes.Status200OK)
            .RequireAuthorization()
            .WithTags(nameof(HabitEntryModel))
            .WithName("GetHabitEntries")
            .WithDescription("Get habit entries for the current authenticated user.");
    }

    private static async Task<IResult> HandleAsync(
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        var commandResult = await sender.Send(new GetHabitEntriesQuery(), cancellationToken);
        if (commandResult.IsFailure)
        {
            return commandResult.ToTypedHttpResult();
        }

        var response = new GetHabitEntriesQueryResponse(commandResult.Value!.HabitEntries);

        return TypedResults.Ok(response);
    }
}