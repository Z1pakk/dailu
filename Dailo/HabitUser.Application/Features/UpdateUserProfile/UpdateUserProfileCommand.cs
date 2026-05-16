using HabitUser.Application.IntegratedServices;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;

namespace HabitUser.Application.Features.UpdateUserProfile;

public sealed record UpdateUserProfileCommand(string FirstName, string LastName) : ICommand<Result>;

public sealed class UpdateUserProfileCommandHandler(
    ICurrentUserService currentUserService,
    IUserProfileService userProfileService
) : ICommandHandler<UpdateUserProfileCommand, Result>
{
    public async ValueTask<Result> Handle(
        UpdateUserProfileCommand request,
        CancellationToken cancellationToken
    )
    {
        var userId = currentUserService.UserId;

        var result = await userProfileService.UpdateUserProfileAsync(
            userId,
            request.FirstName,
            request.LastName,
            cancellationToken
        );

        return result;
    }
}

