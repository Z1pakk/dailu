using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using SharedKernel.Endpoint;
using StrictId;
using Tag.Application.Features.CreateTag;
using Tag.Application.Models;

namespace Tag.Api.Endpoints;

internal sealed record CreateTagResponse(Id<TagModel> Id);

internal static class CreateTag
{
    internal static IEndpointConventionBuilder MapCreateTagEndpoint(this IEndpointRouteBuilder app)
    {
        return app.MapPost(
                "/",
                async (
                    CreateTagCommand payload,
                    ISender sender,
                    CancellationToken cancellationToken
                ) => await HandleAsync(payload, sender, cancellationToken)
            )
            .Produces<CreateTagResponse>(StatusCodes.Status201Created)
            .RequireAuthorization()
            .WithTags(nameof(Tag))
            .WithName("CreateTag")
            .WithDescription("Creates a new tag for the current authenticated user.");
    }

    private static async Task<IResult> HandleAsync(
        CreateTagCommand request,
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        var commandResult = await sender.Send(request, cancellationToken);
        if (commandResult.IsFailure)
        {
            return commandResult.ToTypedHttpResult();
        }

        var response = new CreateTagResponse(commandResult.Value.Id);

        return TypedResults.Created($"{EndpointConfig.BaseApiPath}/tags/{response.Id}", response);
    }
}
