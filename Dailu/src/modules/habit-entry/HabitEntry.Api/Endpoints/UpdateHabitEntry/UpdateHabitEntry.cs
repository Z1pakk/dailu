using HabitEntry.Application.Features.UpdateHabitEntry;
using HabitEntry.Application.Models;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using StrictId;

namespace HabitEntry.Api.Endpoints.UpdateHabitEntry;

internal static class UpdateHabitEntry
{
    internal static IEndpointConventionBuilder MapUpdateHabitEntryEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapPut(
                "/{id}",
                async (
                    Id<HabitEntryModel> id,
                    UpdateHabitEntryCommand command,
                    ISender sender,
                    CancellationToken cancellationToken
                ) => await HandleAsync(id, command, sender, cancellationToken)
            )
            .Produces(StatusCodes.Status204NoContent)
            .RequireAuthorization()
            .WithTags(nameof(HabitEntryModel))
            .WithName("UpdateHabitEntry")
            .WithDescription("Updates an existing habit entry for the current authenticated user.");
    }

    private static async Task<IResult> HandleAsync(
        Id<HabitEntryModel> id,
        UpdateHabitEntryCommand command,
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        var result = await sender.Send(command with { EntryId = id }, cancellationToken);
        if (result.IsFailure)
        {
            return result.ToTypedHttpResult();
        }

        return TypedResults.NoContent();
    }
}
