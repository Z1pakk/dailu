namespace SharedKernel.Event;

public interface IEventDispatcher
{
    Task SendAsync<T>(T @event, CancellationToken cancellationToken = default)
        where T : IEvent;

    Task SendAsync<T>(IReadOnlyList<T> events, CancellationToken cancellationToken = default)
        where T : IEvent;
}
