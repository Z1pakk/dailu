using SharedKernel.Event;
using StrictId;

namespace Dailu.Events.IntegrationEvents;

public record TagNameChangedIntegrationEvent(Id TagId, Guid UserId, string Name)
    : IIntegrationEvent;
