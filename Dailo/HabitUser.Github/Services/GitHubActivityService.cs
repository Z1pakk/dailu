using Dailo.Events;
using HabitUser.Domain.Integrations;
using HabitUser.Github.Models;
using Mediator;
using Microsoft.Extensions.Logging;
using SharedKernel.ResultPattern;

namespace HabitUser.Github.Services;

public interface IGitHubActivityService
{
    Task<Result> PollAndSendAsync(
        Guid identityUserId,
        GithubIntegrationConfig config,
        DateTime? lastSyncedAtUtc = null,
        CancellationToken cancellationToken = default
    );
}

public sealed class GitHubActivityService(
    IGitHubHttpClient gitHubHttpClient,
    IPublisher publisher,
    TimeProvider timeProvider,
    ILogger<GitHubActivityService> logger
) : IGitHubActivityService
{
    public async Task<Result> PollAndSendAsync(
        Guid identityUserId,
        GithubIntegrationConfig config,
        DateTime? lastSyncedAtUtc = null,
        CancellationToken cancellationToken = default
    )
    {
        if (
            string.IsNullOrEmpty(config.AccessToken)
            || config.ExpiresAtUtc < timeProvider.GetUtcNow().UtcDateTime
        )
        {
            return Result.Failure("GitHub access token is missing or expired.");
        }

        var userProfile = await gitHubHttpClient.GetUserProfileAsync(
            config.AccessToken,
            cancellationToken
        );

        if (userProfile?.Login is null)
        {
            return Result.Failure("Failed to fetch GitHub user profile or login is missing.");
        }

        var eventsResult = await gitHubHttpClient.GetUserEventsAsync(
            userProfile.Login,
            config.AccessToken,
            cancellationToken
        );

        if (eventsResult.IsFailure)
        {
            logger.LogError(
                "Failed to fetch GitHub events for user {IdentityUserId}: {Error}",
                identityUserId,
                eventsResult.Error
            );

            return Result.Failure("Failed to fetch GitHub events.");
        }

        var todayDay = timeProvider.GetUtcNow().UtcDateTime.Date.AddDays(-7);

        var filteredEvents = eventsResult
            .Value.Where(e =>
                (e.Type == GitHubEventTypes.Push || e.Type == GitHubEventTypes.PullRequest)
                && e.CreatedAtUtc > todayDay
                && (e.CreatedAtUtc > lastSyncedAtUtc || lastSyncedAtUtc is null)
            )
            .ToList();

        foreach (
            var pushEvent in filteredEvents.Where(e =>
                e.Type == GitHubEventTypes.Push
                && e.HeadCommitSha is not null
                && e.RepoName is not null
            )
        )
        {
            pushEvent.CommitMessage = await gitHubHttpClient.GetCommitMessageAsync(
                pushEvent.RepoName!,
                pushEvent.HeadCommitSha!,
                config.AccessToken,
                cancellationToken
            );
        }

        foreach (
            var prEvent in filteredEvents.Where(e =>
                e.Type == GitHubEventTypes.PullRequest
                && e.PrNumber is not null
                && e.RepoName is not null
            )
        )
        {
            prEvent.PrTitle = await gitHubHttpClient.GetPullRequestTitleAsync(
                prEvent.RepoName!,
                prEvent.PrNumber!.Value,
                config.AccessToken,
                cancellationToken
            );
        }

        var activities = filteredEvents
            .Select(e => new IntegrationActivityItem(e.Id, e.CreatedAtUtc, BuildNotes(e)))
            .ToList();

        if (activities.Count == 0)
        {
            return Result.Success();
        }

        await publisher.Publish(
            new IntegrationActivitiesDetectedIntegrationEvent(
                identityUserId,
                IntegrationActivitySource.Github,
                activities
            ),
            cancellationToken
        );

        return Result.Success();
    }

    private static string? BuildNotes(GitHubEventModel e)
    {
        string? content = null;
        string? label = null;

        if (e.Type == GitHubEventTypes.Push)
        {
            label = "Push";
            content = e.CommitMessage;
        }
        else if (e.Type == GitHubEventTypes.PullRequest)
        {
            label = "PullRequest";
            content = e.PrAction is not null ? $"{e.PrAction} - {e.PrTitle}" : e.PrTitle;
        }

        if (label is null)
        {
            return null;
        }

        var prefix = $"[{label}]";
        if (e.RepoName is not null && content is not null)
        {
            return $"{prefix} {e.RepoName}: {content}";
        }
        if (e.RepoName is not null)
        {
            return $"{prefix} {e.RepoName}";
        }
        if (content is not null)
        {
            return $"{prefix} {content}";
        }

        return prefix;
    }
}
