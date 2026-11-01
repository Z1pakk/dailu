using SharedKernel.Event;

namespace Dailu.Events.IntegrationEvents;

public record IdentityUserCreatedIntegrationEvent(Guid IdentityUserId) : IIntegrationEvent;
