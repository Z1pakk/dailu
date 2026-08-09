using SharedKernel.Event;

namespace Dailu.Events;

public record IdentityUserCreatedIntegrationEvent(Guid IdentityUserId) : IIntegrationEvent;
