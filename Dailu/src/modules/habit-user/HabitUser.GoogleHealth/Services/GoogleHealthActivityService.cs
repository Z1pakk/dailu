using Dailu.Events;
using HabitUser.Domain.ValueObjects.IntegrationConfigs;
using Mediator;
using Microsoft.Extensions.Logging;
using SharedKernel.Event;
using SharedKernel.ResultPattern;

namespace HabitUser.GoogleHealth.Services;

public interface IGoogleHealthActivityService
{
    Task<GoogleHealthPollResult> PollAndSendAsync(
        Guid identityUserId,
        GoogleHealthIntegrationConfig config,
        DateTime? lastSyncedAtUtc,
        CancellationToken cancellationToken
    );
}

public sealed class GoogleHealthActivityService(
    IGoogleHealthHttpClient googleHealthApiClient,
    IEventDispatcher eventDispatcher,
    TimeProvider timeProvider,
    ILogger<GoogleHealthActivityService> logger
) : IGoogleHealthActivityService
{
    public async Task<GoogleHealthPollResult> PollAndSendAsync(
        Guid identityUserId,
        GoogleHealthIntegrationConfig config,
        DateTime? lastSyncedAtUtc,
        CancellationToken cancellationToken
    )
    {
        var after = lastSyncedAtUtc ?? timeProvider.GetUtcNow().UtcDateTime.Date;

        var activitiesResult = await googleHealthApiClient.GetActivitiesAsync(
            config,
            after,
            cancellationToken
        );

        if (activitiesResult.IsFailure)
        {
            logger.LogError(
                "Failed to fetch Google Health activities for user {UserId}: {Error}",
                identityUserId,
                activitiesResult.Error
            );
            return new GoogleHealthPollResult(
                Result.Failure("Failed to fetch Google Health activities.")
            );
        }

        var activities = activitiesResult
            .Value.Activities.Select(a => new IntegrationActivityItem(
                ExternalId: a.Id,
                OccurredAtUtc: a.StartDateUtc,
                Notes: BuildNotes(a.ExerciseType, a.DisplayName, a.ActiveDurationSeconds),
                Value: Math.Max(1, a.ActiveDurationSeconds / 60),
                Source: new IntegrationActivitySourceDetails("Exercise")
            ))
            .ToList();

        if (activities.Count == 0)
        {
            return new GoogleHealthPollResult(Result.Success(), activitiesResult.Value.RefreshedConfig);
        }

        await eventDispatcher.SendAsync(
            new IntegrationActivitiesDetectedIntegrationEvent(
                identityUserId,
                IntegrationActivitySource.GoogleHealth,
                activities
            ),
            cancellationToken
        );

        return new GoogleHealthPollResult(Result.Success(), activitiesResult.Value.RefreshedConfig);
    }

    private static string BuildNotes(string exerciseType, string? displayName, int durationSeconds)
    {
        var label = string.IsNullOrEmpty(displayName) ? exerciseType : displayName;
        var duration = durationSeconds > 0 ? $" ({durationSeconds / 60} min)" : string.Empty;
        return $"[{label}]{duration}";
    }
}
