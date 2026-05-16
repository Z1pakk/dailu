using Mediator;

namespace SharedKernel.Event;

public interface IEvent : INotification
{
    Guid EventId => Guid.CreateVersion7();
    DateTime OccurredOn => DateTime.Now;
    string? EventType => GetType().AssemblyQualifiedName;
}
