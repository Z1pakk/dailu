using Dailu.Events;
using HabitUser.Domain.ValueObjects.IntegrationConfigs;
using Mediator;
using Microsoft.Extensions.Logging;
using SharedKernel.Event;
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
    IEventDispatcher eventDispatcher,
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
            return new GoogleHealthActivityPollResult(
                Result.Failure("Failed to fetch Google Health activities.")
            );
        }

        // Reuse whatever config the exercise call ended up with, so the steps call doesn't
        // attempt a redundant refresh against a token that was just rotated.
        var effectiveConfig = activitiesResult.Value.RefreshedConfig ?? config;

        var stepsResult = await googleHealthApiClient.GetStepsAsync(
            effectiveConfig,
            after,
            cancellationToken
        );

        if (stepsResult.IsFailure)
        {
            logger.LogError(
                "Failed to fetch Google Health steps for user {UserId}: {Error}",
                identityUserId,
                stepsResult.Error
            );
            return new GoogleHealthActivityPollResult(
                Result.Failure("Failed to fetch Google Health steps.")
            );
        }

        var refreshedConfig = stepsResult.Value.RefreshedConfig ?? activitiesResult.Value.RefreshedConfig;

        var activities = activitiesResult
            .Value.Activities.Select(a => new IntegrationActivityItem(
                ExternalId: a.Id,
                OccurredAtUtc: a.StartDateUtc,
                Notes: BuildNotes(a.ExerciseType, a.DisplayName, a.ActiveDurationSeconds),
                Value: Math.Max(1, a.ActiveDurationSeconds / 60),
                Source: new IntegrationActivitySourceDetails("Exercise")
            ))
            .Concat(
                stepsResult.Value.Steps.Select(s => new IntegrationActivityItem(
                    ExternalId: BuildStepsExternalId(identityUserId, s.Date),
                    // DateOnly.ToDateTime always returns Kind=Unspecified; Npgsql rejects that
                    // for a timestamptz column, so it must be marked Utc explicitly.
                    OccurredAtUtc: DateTime.SpecifyKind(s.Date.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc),
                    Notes: null,
                    Value: (int)Math.Min(s.StepCount, int.MaxValue),
                    Source: new IntegrationActivitySourceDetails("Steps")
                ))
            )
            .ToList();

        if (activities.Count == 0)
        {
            return new GoogleHealthActivityPollResult(Result.Success(), refreshedConfig);
        }

        await eventDispatcher.SendAsync(
            new IntegrationActivitiesDetectedIntegrationEvent(
                identityUserId,
                IntegrationActivitySource.GoogleHealth,
                activities
            ),
            cancellationToken
        );

        return new GoogleHealthActivityPollResult(Result.Success(), refreshedConfig);
    }

    private static string BuildNotes(string exerciseType, string? displayName, int durationSeconds)
    {
        var label = string.IsNullOrEmpty(displayName) ? exerciseType : displayName;
        var duration = durationSeconds > 0 ? $" ({durationSeconds / 60} min)" : string.Empty;
        return $"[{label}]{duration}";
    }

    // Deterministic per user+day so repeated polls of the same (still accumulating) day update
    // the same habit entry instead of creating a new one every time.
    private static string BuildStepsExternalId(Guid identityUserId, DateOnly date) =>
        $"google-health-steps-{identityUserId:N}-{date:yyyy-MM-dd}";
}
