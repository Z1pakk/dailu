using SharedKernel.Event;

namespace Dailo.Events;

public enum IntegrationActivitySource
{
    None = 0,
    Github = 1,
    Strava = 2,
}

public sealed record IntegrationActivityItem(
    string ExternalId,
    DateTime OccurredAtUtc,
    string? Notes = null,
    int Value = 1
);

public sealed record IntegrationActivitiesDetectedIntegrationEvent(
    Guid UserId,
    IntegrationActivitySource Source,
    IReadOnlyList<IntegrationActivityItem> Activities
) : IIntegrationEvent;
