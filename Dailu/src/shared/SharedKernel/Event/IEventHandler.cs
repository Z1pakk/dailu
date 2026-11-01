using Mediator;

namespace SharedKernel.Event;

public interface IEventHandler<in T> : INotificationHandler<T>
    where T : IEvent;
