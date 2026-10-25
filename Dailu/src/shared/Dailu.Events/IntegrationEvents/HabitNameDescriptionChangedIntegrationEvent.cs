using SharedKernel.Event;
using StrictId;

namespace Dailu.Events.IntegrationEvents;

public record HabitNameDescriptionChangedIntegrationEvent(
    Id HabitId,
    Guid UserId,
    string Name,
    string? Description,
    bool IsArchived
) : IIntegrationEvent;
