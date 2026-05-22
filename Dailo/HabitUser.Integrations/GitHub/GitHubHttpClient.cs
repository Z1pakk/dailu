using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HabitUser.Application.IntegratedServices;
using HabitUser.Application.Models;
using HabitUser.Integrations.GitHub.Models;
using Microsoft.Extensions.Logging;
using SharedKernel.ResultPattern;

namespace HabitUser.Integrations.GitHub;

public sealed class GitHubHttpClient(HttpClient httpclient, ILogger<GitHubHttpClient> logger)
    : IGitHubHttpClient
{
    public async Task<GitHubUserProfileModel?> GetUserProfileAsync(
        string accessToken,
        CancellationToken cancellationToken = default
    )
    {
        var client = CreateGitHubClient(accessToken);

        try
        {
            var response = await client.GetAsync("user", cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError(
                    "Failed to fetch GitHub user profile: {StatusCode}",
                    response.StatusCode
                );
                return null;
            }

            var raw = await response.Content.ReadFromJsonAsync<GitHubUserResponse>(
                JsonSerializerOptions.Web,
                cancellationToken
            );

            if (raw is null)
            {
                return null;
            }

            return new GitHubUserProfileModel
            {
                Id = raw.Id,
                Login = raw.Login,
                Url = raw.Url,
                Name = raw.Name,
                Email = raw.Email,
                PublicRepos = raw.PublicRepos,
                Followers = raw.Followers,
                Following = raw.Following,
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch GitHub user profile");
            return null;
        }
    }

    public async Task<Result<IEnumerable<GitHubEventModel>>> GetUserEventsAsync(
        string userName,
        string accessToken,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(userName);

        var client = CreateGitHubClient(accessToken);
        try
        {
            var response = await client.GetAsync(
                $"users/{userName}/events?per_page=100",
                cancellationToken
            );
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError(
                    "Failed to fetch GitHub user events: {StatusCode}",
                    response.StatusCode
                );

                return Result<IEnumerable<GitHubEventModel>>.Failure(
                    $"Failed to fetch GitHub user events: {response.StatusCode}"
                );
            }

            var mappedResponse = await response.Content.ReadFromJsonAsync<
                IEnumerable<GitHubEventResponse>
            >(JsonSerializerOptions.Web, cancellationToken);
            if (mappedResponse is null)
            {
                return null;
            }

            return Result<IEnumerable<GitHubEventModel>>.Success(
                mappedResponse.Select(e => new GitHubEventModel
                {
                    Id = e.Id,
                    Type = e.Type,
                    CreatedAtUtc = e.CreatedAtUtc,
                    Public = e.Public,
                    RepoName = e.Repo?.Name,
                    HeadCommitSha = e.Payload?.Head,
                    PrNumber = e.Payload?.Number,
                    PrAction = e.Payload?.Action,
                })
            );
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch GitHub user events");
            return Result<IEnumerable<GitHubEventModel>>.Failure(
                "Failed to fetch GitHub user events due to an unexpected error."
            );
        }
    }

    public async Task<string?> GetCommitMessageAsync(
        string repoFullName,
        string sha,
        string accessToken,
        CancellationToken cancellationToken = default
    )
    {
        var client = CreateGitHubClient(accessToken);
        try
        {
            var response = await client.GetAsync(
                $"repos/{repoFullName}/commits/{sha}",
                cancellationToken
            );
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError(
                    "Failed to fetch commit {Sha} for {Repo}: {StatusCode}",
                    sha,
                    repoFullName,
                    response.StatusCode
                );
                return null;
            }

            var raw = await response.Content.ReadFromJsonAsync<GitHubCommitDetailResponse>(
                JsonSerializerOptions.Web,
                cancellationToken
            );

            return raw?.Commit?.Message;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch commit {Sha} for {Repo}", sha, repoFullName);
            return null;
        }
    }

    public async Task<string?> GetPullRequestTitleAsync(
        string repoFullName,
        int prNumber,
        string accessToken,
        CancellationToken cancellationToken = default
    )
    {
        var client = CreateGitHubClient(accessToken);
        try
        {
            var response = await client.GetAsync(
                $"repos/{repoFullName}/pulls/{prNumber}",
                cancellationToken
            );
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError(
                    "Failed to fetch PR #{PrNumber} for {Repo}: {StatusCode}",
                    prNumber,
                    repoFullName,
                    response.StatusCode
                );
                return null;
            }

            var raw = await response.Content.ReadFromJsonAsync<GitHubPullRequestDetailResponse>(
                JsonSerializerOptions.Web,
                cancellationToken
            );

            return raw?.Title;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch PR #{PrNumber} for {Repo}", prNumber, repoFullName);
            return null;
        }
    }

    private HttpClient CreateGitHubClient(string accessToken)
    {
        httpclient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            accessToken
        );
        return httpclient;
    }
}
