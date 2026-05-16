using HabitUser.Application.IntegratedServices;
using HabitUser.Application.Models;
using Identity.DataTransfer.Services;
using SharedKernel.ResultPattern;

namespace HabitUser.Integrations.Identity.Services;

public class UserProfileService(IIdentityUserDataTransferService identityUserDataTransferService)
    : IUserProfileService
{
    public async Task<Result<UserProfileModel>> GetUserProfileAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    )
    {
        var result = await identityUserDataTransferService.GetUserDataTransferAsync(
            userId,
            cancellationToken
        );

        if (result.IsFailure)
        {
            return result.ToTargetResult<UserProfileModel>();
        }

        var userModel = result.Value!;

        var profileModel = new UserProfileModel(
            userModel.Id,
            userModel.Email!,
            userModel.FirstName,
            userModel.LastName
        );

        return Result<UserProfileModel>.Success(profileModel);
    }

    public async Task<Result> UpdateUserProfileAsync(
        Guid userId,
        string firstName,
        string lastName,
        CancellationToken cancellationToken = default
    )
    {
        return await identityUserDataTransferService.UpdateUserProfileAsync(
            userId,
            firstName,
            lastName,
            cancellationToken
        );
    }
}
