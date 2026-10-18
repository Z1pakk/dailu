using SharedKernel.Event;
using StrictId;

namespace Dailu.Events;

public record TagNameChangedIntegrationEvent(Id TagId, Guid UserId, string Name)
    : IIntegrationEvent;
