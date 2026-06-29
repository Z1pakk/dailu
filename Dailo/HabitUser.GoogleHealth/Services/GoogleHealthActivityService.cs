using Dailo.Events;
using HabitUser.Domain.Integrations;
using Mediator;
using Microsoft.Extensions.Logging;
using SharedKernel.ResultPattern;

namespace HabitUser.GoogleHealth.Services;

public sealed record GoogleHealthActivityPollResult(
    Result Result,
    GoogleHealthIntegrationConfig? RefreshedConfig = null
);

public interface IGoogleHealthActivityService
{
    Task<GoogleHealthActivityPollResult> PollAndSendAsync(
        Guid identityUserId,
        GoogleHealthIntegrationConfig config,
        DateTime? lastSyncedAtUtc,
        CancellationToken cancellationToken
    );
}

public sealed class GoogleHealthActivityService(
    IGoogleHealthHttpClient googleHealthApiClient,
    IPublisher publisher,
    TimeProvider timeProvider,
    ILogger<GoogleHealthActivityService> logger
) : IGoogleHealthActivityService
{
    public async Task<GoogleHealthActivityPollResult> PollAndSendAsync(
        Guid identityUserId,
        GoogleHealthIntegrationConfig config,
        DateTime? lastSyncedAtUtc,
        CancellationToken cancellationToken
    )
    {
        var after = lastSyncedAtUtc ?? timeProvider.GetUtcNow().UtcDateTime.Date;

        var apiResult = await googleHealthApiClient.GetActivitiesAsync(config, after, cancellationToken);

        if (apiResult.IsFailure)
        {
            logger.LogError(
                "Failed to fetch Google Health activities for user {UserId}: {Error}",
                identityUserId,
                apiResult.Error
            );
            return new GoogleHealthActivityPollResult(
                Result.Failure("Failed to fetch Google Health activities.")
            );
        }

        var activities = apiResult
            .Value.Activities.Select(a => new IntegrationActivityItem(
                ExternalId: a.Id,
                OccurredAtUtc: a.StartDateUtc,
                Notes: BuildNotes(a.ExerciseType, a.DisplayName, a.ActiveDurationSeconds),
                Value: Math.Max(1, a.ActiveDurationSeconds / 60)
            ))
            .ToList();

        if (activities.Count == 0)
        {
            return new GoogleHealthActivityPollResult(Result.Success());
        }

        await publisher.Publish(
            new IntegrationActivitiesDetectedIntegrationEvent(
                identityUserId,
                IntegrationActivitySource.GoogleHealth,
                activities
            ),
            cancellationToken
        );

        return new GoogleHealthActivityPollResult(Result.Success(), apiResult.Value.RefreshedConfig);
    }

    private static string BuildNotes(string exerciseType, string? displayName, int durationSeconds)
    {
        var label = string.IsNullOrEmpty(displayName) ? exerciseType : displayName;
        var duration = durationSeconds > 0
            ? $" ({durationSeconds / 60} min)"
            : string.Empty;
        return $"[{label}]{duration}";
    }
}
