using Mediator;
using SharedKernel.CQRS;

namespace Dailu.Infrastructure.Event;

internal sealed class EventPublisher(IPublisher publisher) : IEventPublisher
{
    public ValueTask Publish<TNotification>(
        TNotification notification,
        CancellationToken cancellationToken = default
    )
        where TNotification : INotification => publisher.Publish(notification, cancellationToken);

    public ValueTask Publish(object notification, CancellationToken cancellationToken = default) =>
        publisher.Publish(notification, cancellationToken);
}
