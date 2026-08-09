using Mediator;
using SharedKernel.Event;

namespace SharedInfrastructure.Event;

public sealed class EventDispatcher(IPublisher publisher, IIntegrationEventBus bus)
    : IEventDispatcher
{
    public async Task SendAsync<T>(T @event, CancellationToken cancellationToken = default)
        where T : IEvent
    {
        await SendAsync([@event], cancellationToken);
    }

    public async Task SendAsync<T>(
        IReadOnlyList<T> events,
        CancellationToken cancellationToken = default
    )
        where T : IEvent
    {
        foreach (var @event in events)
        {
            if (@event is IDomainEvent domainEvent)
            {
                await publisher.Publish(domainEvent, cancellationToken);
            }

            if (@event is IIntegrationEvent integrationEvent)
            {
                await bus.PublishAsync(integrationEvent, cancellationToken);
            }
        }
    }
}
