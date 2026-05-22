using HabitUser.Application.Models;
using SharedKernel.ResultPattern;

namespace HabitUser.Application.IntegratedServices;

public interface IGitHubHttpClient
{
    Task<GitHubUserProfileModel?> GetUserProfileAsync(
        string accessToken,
        CancellationToken cancellationToken = default
    );

    Task<Result<IEnumerable<GitHubEventModel>>> GetUserEventsAsync(
        string userName,
        string accessToken,
        CancellationToken cancellationToken = default
    );

    Task<string?> GetCommitMessageAsync(
        string repoFullName,
        string sha,
        string accessToken,
        CancellationToken cancellationToken = default
    );

    Task<string?> GetPullRequestTitleAsync(
        string repoFullName,
        int prNumber,
        string accessToken,
        CancellationToken cancellationToken = default
    );
}
