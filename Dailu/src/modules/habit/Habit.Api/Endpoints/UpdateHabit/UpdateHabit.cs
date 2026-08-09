using Habit.Application.Features.UpdateHabit;
using Habit.Application.Models;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using StrictId;

namespace Habit.Api.Endpoints.UpdateHabit;

internal static class UpdateHabit
{
    internal static IEndpointConventionBuilder MapUpdateHabitEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapPut(
                "/{id}",
                async (
                    Id<HabitModel> id,
                    UpdateHabitCommand command,
                    ISender sender,
                    CancellationToken cancellationToken
                ) => await HandleAsync(id, command, sender, cancellationToken)
            )
            .Produces(StatusCodes.Status204NoContent)
            .RequireAuthorization()
            .WithTags(nameof(Habit))
            .WithName("UpdateHabit")
            .WithDescription("Updates an existing habit for the current authenticated user.");
    }

    private static async Task<IResult> HandleAsync(
        Id<HabitModel> id,
        UpdateHabitCommand command,
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        var result = await sender.Send(command with { HabitId = id }, cancellationToken);
        if (result.IsFailure)
        {
            return result.ToTypedHttpResult();
        }

        return TypedResults.NoContent();
    }
}
