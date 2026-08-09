using SharedKernel.Event;
using StrictId;

namespace Dailu.Events;

public sealed record HabitEntryCompletedIntegrationEvent(Id HabitId, DateTime CompletedAtUtc)
    : IIntegrationEvent;
