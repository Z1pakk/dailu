using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Tag.Application.Features.GetTags;
using Tag.Application.Models;

namespace Tag.Api.Endpoints;

internal sealed record GetTagsResponse(IEnumerable<TagModel> Tags);

internal static class GetTags
{
    internal static IEndpointConventionBuilder MapGetTagsEndpoint(this IEndpointRouteBuilder app)
    {
        return app.MapGet(
                "/",
                async (ISender sender, CancellationToken cancellationToken) =>
                    await HandleAsync(sender, cancellationToken)
            )
            .Produces<GetTagsResponse>(StatusCodes.Status200OK)
            .RequireAuthorization()
            .WithTags(nameof(Tag))
            .WithName("GetTags")
            .WithDescription("Get tags for the current authenticated user.");
    }

    private static async Task<IResult> HandleAsync(
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        var queryResult = await sender.Send(new GetTagsQuery(), cancellationToken);
        if (queryResult.IsFailure)
        {
            return queryResult.ToTypedHttpResult();
        }

        return TypedResults.Ok(new GetTagsResponse(queryResult.Value.Tags));
    }
}
