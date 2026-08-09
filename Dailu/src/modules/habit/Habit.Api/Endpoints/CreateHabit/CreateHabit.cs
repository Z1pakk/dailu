using Habit.Application.Features.CreateHabit;
using Habit.Application.Models;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SharedKernel.Endpoint;
using StrictId;

namespace Habit.Api.Endpoints.CreateHabit;

internal sealed record CreateHabitResponse(Id<HabitModel> Id);

internal static class CreateHabit
{
    internal static IEndpointConventionBuilder MapCreateHabitEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapPost(
                "/",
                async (
                    CreateHabitCommand payload,
                    ISender sender,
                    CancellationToken cancellationToken
                ) => await HandleAsync(payload, sender, cancellationToken)
            )
            .Produces<CreateHabitResponse>(StatusCodes.Status201Created)
            .RequireAuthorization()
            .WithTags(nameof(Habit))
            .WithName("CreateHabit")
            .WithDescription("Creates a new habit for the current authenticated user.");
    }

    private static async Task<IResult> HandleAsync(
        CreateHabitCommand request,
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        var commandResult = await sender.Send(request, cancellationToken);
        if (commandResult.IsFailure)
        {
            return commandResult.ToTypedHttpResult();
        }

        var response = new CreateHabitResponse(commandResult.Value.Id);

        return TypedResults.Created($"{EndpointConfig.BaseApiPath}/habits/{response.Id}", response);
    }
}
