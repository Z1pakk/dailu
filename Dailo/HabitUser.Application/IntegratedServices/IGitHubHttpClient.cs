using HabitUser.Application.Models;

namespace HabitUser.Application.IntegratedServices;

public interface IGitHubHttpClient
{
    Task<GitHubUserProfileModel?> GetUserProfileAsync(
        string accessToken,
        CancellationToken cancellationToken = default
    );
    //
    // Task<IEnumerable<GitHubEventDto>?> GetUserEventsAsync(
    //     string userName,
    //     string accessToken,
    //     CancellationToken cancellationToken = default
    // );
}
