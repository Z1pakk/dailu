using System.Globalization;
using Dailo.Events;
using HabitUser.Application.IntegratedServices;
using HabitUser.Domain.Integrations;
using Mediator;
using Microsoft.Extensions.Logging;
using SharedKernel.ResultPattern;

namespace HabitUser.Application.Features.Strava;

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
    TimeProvider timeProvider,
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
        var after = lastSyncedAtUtc ?? timeProvider.GetUtcNow().UtcDateTime.Date;

        var apiResult = await stravaApiClient.GetActivitiesAsync(config, after, cancellationToken);

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
                ExternalId: a.Id.ToString(CultureInfo.InvariantCulture),
                OccurredAtUtc: a.StartDateUtc,
                Notes: BuildNotes(a.Type, a.Name, a.Distance, a.Description),
                Value: a.Distance > 0 ? Math.Max(1, (int)Math.Round(a.Distance / 10f)) : 1
            ))
            .ToList();

        if (activities.Count == 0)
        {
            return new StravaActivityPollResult(Result.Success());
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

    private static string BuildNotes(string type, string name, float distance, string? description)
    {
        var distanceKm = distance > 0 ? $" ({distance / 1000:F1} km)" : string.Empty;
        var desc = !string.IsNullOrWhiteSpace(description) ? $" — {description}" : string.Empty;
        return $"[{type}] {name}{distanceKm}{desc}";
    }
}
