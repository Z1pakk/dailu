using Mediator;
using SharedKernel.CQRS;
using SharedKernel.Event;

namespace SharedInfrastructure.Event;

public sealed class InMemoryIntegrationEventBus(IEventPublisher publisher) : IIntegrationEventBus
{
    public ValueTask PublishAsync(
        IIntegrationEvent integrationEvent,
        CancellationToken cancellationToken = default
    ) => publisher.Publish(integrationEvent, cancellationToken);
}
