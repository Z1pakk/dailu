using SharedKernel.Event;

namespace SharedKernel.Domain;

public interface IHasDomainEvents
{
    IReadOnlyList<IEvent> DomainEvents { get; }
    void AddDomainEvent(IEvent domainEvent);
    void ClearDomainEvents();
}
