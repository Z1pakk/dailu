using SharedKernel.Event;
using StrictId;

namespace Dailu.Events;

public record HabitEntryNoteChangedIntegrationEvent(
    Id EntryId,
    Guid UserId,
    Id HabitId,
    string? Notes,
    DateTime CompletedAtUtc,
    bool IsArchived
) : IIntegrationEvent;
