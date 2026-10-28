using System.Collections.Concurrent;
using SharedKernel.Event;

namespace Test.SharedKernel.Event;

public sealed class FakeIntegrationEventBus : IIntegrationEventBus
{
    private readonly ConcurrentQueue<IIntegrationEvent> _published = new();

    public IReadOnlyCollection<IIntegrationEvent> Published => _published;

    public IEnumerable<TEvent> PublishedOf<TEvent>()
        where TEvent : IIntegrationEvent => _published.OfType<TEvent>();

    public ValueTask PublishAsync(
        IIntegrationEvent integrationEvent,
        CancellationToken cancellationToken = default
    )
    {
        _published.Enqueue(integrationEvent);
        return ValueTask.CompletedTask;
    }

    public void Clear() => _published.Clear();
}
