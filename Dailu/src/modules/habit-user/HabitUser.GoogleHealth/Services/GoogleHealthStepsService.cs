using Dailu.Events;
using HabitUser.Domain.ValueObjects.IntegrationConfigs;
using Mediator;
using Microsoft.Extensions.Logging;
using SharedKernel.Event;
using SharedKernel.ResultPattern;

namespace HabitUser.GoogleHealth.Services;

public interface IGoogleHealthStepsService
{
    Task<GoogleHealthPollResult> PollAndSendAsync(
        Guid identityUserId,
        GoogleHealthIntegrationConfig config,
        DateTime? lastSyncedAtUtc,
        CancellationToken cancellationToken
    );
}

public sealed class GoogleHealthStepsService(
    IGoogleHealthHttpClient googleHealthApiClient,
    IEventDispatcher eventDispatcher,
    TimeProvider timeProvider,
    ILogger<GoogleHealthStepsService> logger
) : IGoogleHealthStepsService
{
    public async Task<GoogleHealthPollResult> PollAndSendAsync(
        Guid identityUserId,
        GoogleHealthIntegrationConfig config,
        DateTime? lastSyncedAtUtc,
        CancellationToken cancellationToken
    )
    {
        var after = lastSyncedAtUtc ?? timeProvider.GetUtcNow().UtcDateTime.Date;

        var stepsResult = await googleHealthApiClient.GetStepsAsync(
            config,
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
            return new GoogleHealthPollResult(
                Result.Failure("Failed to fetch Google Health steps.")
            );
        }

        var steps = stepsResult
            .Value.Steps.Select(s => new IntegrationActivityItem(
                ExternalId: BuildStepsExternalId(identityUserId, s.Date),
                // Google's daily rollup only reports a date, not a time, so stamp the entry with
                // the actual poll time instead of a synthetic midnight - that way it reflects when
                // the step count was last fetched.
                OccurredAtUtc: timeProvider.GetUtcNow().UtcDateTime,
                Notes: null,
                Value: (int)Math.Min(s.StepCount, int.MaxValue),
                Source: new IntegrationActivitySourceDetails("Steps")
            ))
            .ToList();

        if (steps.Count == 0)
        {
            return new GoogleHealthPollResult(Result.Success(), stepsResult.Value.RefreshedConfig);
        }

        await eventDispatcher.SendAsync(
            new IntegrationActivitiesDetectedIntegrationEvent(
                identityUserId,
                IntegrationActivitySource.GoogleHealth,
                steps
            ),
            cancellationToken
        );

        return new GoogleHealthPollResult(Result.Success(), stepsResult.Value.RefreshedConfig);
    }

    // Deterministic per user+day so repeated polls of the same (still accumulating) day update
    // the same habit entry instead of creating a new one every time.
    private static string BuildStepsExternalId(Guid identityUserId, DateOnly date) =>
        $"google-health-steps-{identityUserId:N}-{date:yyyy-MM-dd}";
}
