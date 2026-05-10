using SharedKernel.Event;

namespace Dailo.Events;

public record IdentityUserCreatedIntegrationEvent(Guid IdentityUserId) : IIntegrationEvent;
