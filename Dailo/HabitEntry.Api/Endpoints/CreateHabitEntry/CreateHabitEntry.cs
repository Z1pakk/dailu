using HabitEntry.Application.Features.CreateHabitEntry;
using HabitEntry.Application.Models;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SharedKernel.Endpoint;
using StrictId;

namespace HabitEntry.Api.Endpoints.CreateHabitEntry;

internal sealed record CreateHabitEntryResponse(Id<HabitEntryModel> Id);

internal static class CreateHabitEntry
{
    internal static IEndpointConventionBuilder MapCreateHabitEntryEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapPost(
                "/",
                async (
                    CreateHabitEntryCommand payload,
                    ISender sender,
                    CancellationToken cancellationToken
                ) => await HandleAsync(payload, sender, cancellationToken)
            )
            .Produces<CreateHabitEntryResponse>(StatusCodes.Status201Created)
            .RequireAuthorization()
            .WithTags(nameof(HabitEntryModel))
            .WithName("CreateHabitEntry")
            .WithDescription("Creates a new habit entry for the current authenticated user.");
    }

    private static async Task<IResult> HandleAsync(
        CreateHabitEntryCommand request,
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        var commandResult = await sender.Send(request, cancellationToken);
        if (commandResult.IsFailure)
        {
            return commandResult.ToTypedHttpResult();
        }

        var response = new CreateHabitEntryResponse(commandResult.Value.Id);

        return TypedResults.Created(
            $"{EndpointConfig.BaseApiPath}/habit-entries/{response.Id}",
            response
        );
    }
}
