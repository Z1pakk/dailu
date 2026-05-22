using Dailo.Events;
using HabitUser.Application.IntegratedServices;
using HabitUser.Domain.Integrations;
using Mediator;
using Microsoft.Extensions.Logging;
using SharedKernel.ResultPattern;

namespace HabitUser.Application.Features.PollIntegrationActivity;

public sealed record StravaActivityPollResult(
    Result Result,
    StravaIntegrationConfig? RefreshedConfig = null
);

public interface IStravaActivityService
{
    Task<StravaActivityPollResult> PollAndSendAsync(
        Guid identityUserId,
        StravaIntegrationConfig config,
        DateTime? lastSyncedAtUtc,
        CancellationToken cancellationToken
    );
}

public sealed class StravaActivityService(
    IStravaHttpClient stravaApiClient,
    IPublisher publisher,
    ILogger<StravaActivityService> logger
) : IStravaActivityService
{
    public async Task<StravaActivityPollResult> PollAndSendAsync(
        Guid identityUserId,
        StravaIntegrationConfig config,
        DateTime? lastSyncedAtUtc,
        CancellationToken cancellationToken
    )
    {
        var apiResult = await stravaApiClient.GetActivitiesAsync(
            config,
            lastSyncedAtUtc,
            cancellationToken
        );

        if (apiResult.IsFailure)
        {
            logger.LogError(
                "Failed to fetch Strava activities for user {UserId}: {Error}",
                identityUserId,
                apiResult.Error
            );
            return new StravaActivityPollResult(
                Result.Failure("Failed to fetch Strava activities.")
            );
        }

        var activities = apiResult
            .Value.Activities.Select(a => new IntegrationActivityItem(
                ExternalId: a.Id.ToString(System.Globalization.CultureInfo.InvariantCulture),
                OccurredAtUtc: a.StartDateUtc,
                Notes: BuildNotes(a.Type, a.Name, a.Distance)
            ))
            .ToList();

        if (activities.Count == 0)
        {
            return new StravaActivityPollResult(
                Result.Failure("No new Strava activities."),
                apiResult.Value.RefreshedConfig
            );
        }

        await publisher.Publish(
            new IntegrationActivitiesDetectedIntegrationEvent(
                identityUserId,
                IntegrationActivitySource.Strava,
                activities
            ),
            cancellationToken
        );

        return new StravaActivityPollResult(Result.Success(), apiResult.Value.RefreshedConfig);
    }

    private static string BuildNotes(string type, string name, float distance)
    {
        var distanceKm = distance > 0 ? $" ({distance / 1000:F1} km)" : string.Empty;
        return $"[{type}] {name}{distanceKm}";
    }
}
