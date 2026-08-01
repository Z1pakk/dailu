using SharedKernel.Event;
using StrictId;

namespace Dailo.Events;

public sealed record HabitAutomationEntryDetected(
    Id HabitId,
    string ExternalId,
    DateTime OccurredAtUtc,
    string? Notes = null,
    int Value = 1
);

public sealed record HabitAutomationEntriesDetectedIntegrationEvent(
    Guid UserId,
    IReadOnlyList<HabitAutomationEntryDetected> Entries
) : IIntegrationEvent;
