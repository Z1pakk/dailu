using Habit.Api.Endpoints.CreateHabit;
using Habit.Application.Features.CreateHabit;
using Habit.Application.Features.GetHabits;
using Habit.Application.Models;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Habit.Api.Endpoints.GetHabits;

internal sealed record GetHabitsResponse(IEnumerable<HabitModel> Habits);

internal static class GetHabits
{
    internal static IEndpointConventionBuilder MapGetHabitsEndpoint(this IEndpointRouteBuilder app)
    {
        return app.MapGet(
                "/",
                async (ISender sender, CancellationToken cancellationToken) =>
                    await HandleAsync(sender, cancellationToken)
            )
            .Produces<GetHabitsResponse>(StatusCodes.Status200OK)
            .RequireAuthorization()
            .WithTags(nameof(Habit))
            .WithName("GetHabits")
            .WithDescription("Get habits for the current authenticated user.");
    }

    private static async Task<IResult> HandleAsync(
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        var commandResult = await sender.Send(new GetHabitsQuery(), cancellationToken);
        if (commandResult.IsFailure)
        {
            return commandResult.ToTypedHttpResult();
        }

        var response = new GetHabitsResponse(commandResult.Value!.Habits);

        return TypedResults.Ok(response);
    }
}
