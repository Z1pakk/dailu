using HabitUser.Application.Features.UpdateUserProfile;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace HabitUser.Api.Endpoints.UpdateUserProfile;

internal sealed record UpdateUserProfileRequest(string FirstName, string LastName);

internal static class UpdateUserProfile
{
    internal static IEndpointConventionBuilder MapUpdateUserProfileEndpoint(
        this IEndpointRouteBuilder app
    )
    {
        return app.MapPut(
                "/profile",
                async (
                    UpdateUserProfileRequest request,
                    ISender sender,
                    CancellationToken cancellationToken
                ) => await HandleAsync(request, sender, cancellationToken)
            )
            .Produces(StatusCodes.Status204NoContent)
            .RequireAuthorization()
            .WithTags("HabitUser")
            .WithName("UpdateUserProfile")
            .WithDescription("Updates user profile for the current authenticated user.");
    }

    private static async Task<IResult> HandleAsync(
        UpdateUserProfileRequest request,
        ISender sender,
        CancellationToken cancellationToken = default
    )
    {
        var command = new UpdateUserProfileCommand(request.FirstName, request.LastName);

        var result = await sender.Send(command, cancellationToken);
        if (result.IsFailure)
        {
            return result.ToTypedHttpResult();
        }

        return TypedResults.NoContent();
    }
}
