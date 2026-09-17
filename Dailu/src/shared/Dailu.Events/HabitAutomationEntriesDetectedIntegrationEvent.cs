using SharedKernel.Event;
using StrictId;

namespace Dailu.Events;

/// <param name="AllowUpdate">
/// When true and an entry with the same HabitId+ExternalId already exists, its value/notes/date
/// are updated in place instead of being skipped. Used by sources that re-report an accumulating
/// total under a stable id (e.g. a day's running step count), as opposed to one-shot activities.
/// </param>
public sealed record HabitAutomationEntryDetected(
    Id HabitId,
    string ExternalId,
    DateTime OccurredAtUtc,
    string? Notes = null,
    int Value = 1,
    bool AllowUpdate = false
);

public sealed record HabitAutomationEntriesDetectedIntegrationEvent(
    Guid UserId,
    IReadOnlyList<HabitAutomationEntryDetected> Entries
) : IIntegrationEvent;
