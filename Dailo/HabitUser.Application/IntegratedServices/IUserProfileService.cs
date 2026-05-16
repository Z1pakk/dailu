using HabitUser.Application.Models;
using SharedKernel.ResultPattern;

namespace HabitUser.Application.IntegratedServices;

public interface IUserProfileService
{
    Task<Result<UserProfileModel>> GetUserProfileAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    );

    Task<Result> UpdateUserProfileAsync(
        Guid userId,
        string firstName,
        string lastName,
        CancellationToken cancellationToken = default
    );
}
