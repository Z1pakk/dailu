using HabitUser.Github.Models;
using SharedKernel.ResultPattern;

namespace HabitUser.Github.Services;

public interface IGitHubHttpClient
{
    Task<string?> ExchangeAuthorizationCodeAsync(
        string code,
        CancellationToken cancellationToken = default
    );

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
