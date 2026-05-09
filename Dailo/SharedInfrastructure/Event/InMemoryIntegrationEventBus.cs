using Mediator;
using SharedKernel.Event;

namespace SharedInfrastructure.Event;

public sealed class InMemoryIntegrationEventBus(IPublisher publisher) : IIntegrationEventBus
{
    public ValueTask PublishAsync(
        IIntegrationEvent integrationEvent,
        CancellationToken cancellationToken = default
    ) => publisher.Publish(integrationEvent, cancellationToken);
}
