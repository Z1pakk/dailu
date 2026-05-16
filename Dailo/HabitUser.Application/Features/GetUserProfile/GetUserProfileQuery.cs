using HabitUser.Application.IntegratedServices;
using HabitUser.Application.Models;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;

namespace HabitUser.Application.Features.GetUserProfile;

public sealed class GetUserProfileQuery : IQuery<Result<GetUserProfileQueryResponse>> { }

public sealed record GetUserProfileQueryResponse(UserProfileModel Profile);

public sealed class GetUserProfileQueryHandler(
    ICurrentUserService currentUserService,
    IUserProfileService userProfileService
) : IQueryHandler<GetUserProfileQuery, Result<GetUserProfileQueryResponse>>
{
    public async ValueTask<Result<GetUserProfileQueryResponse>> Handle(
        GetUserProfileQuery request,
        CancellationToken cancellationToken
    )
    {
        var userId = currentUserService.UserId;

        var result = await userProfileService.GetUserProfileAsync(userId, cancellationToken);

        if (result.IsFailure)
        {
            return result.ToTargetResult<GetUserProfileQueryResponse>();
        }

        var response = new GetUserProfileQueryResponse(result.Value!);

        return Result<GetUserProfileQueryResponse>.Success(response);
    }
}
