using Microsoft.Extensions.Logging;
using SharedKernel.CQRS;
using SharedKernel.Event;

namespace SharedInfrastructure.Event;

public sealed class EventDispatcher(
    IEventPublisher publisher,
    IIntegrationEventBus bus,
    ILogger<EventDispatcher> logger
) : IEventDispatcher
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
            try
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
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Failed to publish {EventType}; the event is lost",
                    @event.GetType().Name
                );
            }
        }
    }
}
