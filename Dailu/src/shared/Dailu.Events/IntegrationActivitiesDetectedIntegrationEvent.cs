using SharedKernel.Event;

namespace Dailu.Events;

public enum IntegrationActivitySource
{
    None = 0,
    Github = 1,
    Strava = 2,
    GoogleHealth = 3,
}

/// <summary>
/// Represents the details of the activity from different providers.
/// </summary>
/// <param name="Type">Type of the activity(e.g. Push, Pull Request, Ride, etc...)</param>
/// <param name="Target">Some target(e.g. Repository Id, Id of the ride, etc...)</param>
public sealed record IntegrationActivitySourceDetails(string Type, string? Target = null);

public sealed record IntegrationActivityItem(
    string ExternalId,
    DateTime OccurredAtUtc,
    string? Notes = null,
    int Value = 1,
    IntegrationActivitySourceDetails? Source = null
);

public sealed record IntegrationActivitiesDetectedIntegrationEvent(
    Guid UserId,
    IntegrationActivitySource Source,
    IReadOnlyList<IntegrationActivityItem> Activities
) : IIntegrationEvent;
