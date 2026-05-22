using SharedKernel.Event;

namespace Dailo.Events;

public enum IntegrationActivitySource
{
    Github = 1,
    Strava = 2,
}

public sealed record IntegrationActivityItem(
    string ExternalId,
    DateTime OccurredAtUtc,
    string? Notes = null
);

public sealed record IntegrationActivitiesDetectedIntegrationEvent(
    Guid UserId,
    IntegrationActivitySource Source,
    IReadOnlyList<IntegrationActivityItem> Activities
) : IIntegrationEvent;
