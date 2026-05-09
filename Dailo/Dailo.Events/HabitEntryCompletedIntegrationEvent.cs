using SharedKernel.Event;
using StrictId;

namespace Dailo.Events;

public sealed record HabitEntryCompletedIntegrationEvent(Id HabitId, DateTime CompletedAtUtc)
    : IIntegrationEvent;
