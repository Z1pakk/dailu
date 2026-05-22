using SharedKernel.Event;

namespace SharedKernel.Domain;

public abstract class Aggregate
{
    private readonly List<IEvent> _domainEvents = [];

    public Guid Version { get; protected set; }

    public IReadOnlyList<IEvent> DomainEvents => _domainEvents.AsReadOnly();

    protected void RaiseDomainEvent(IEvent domainEvent) => _domainEvents.Add(domainEvent);

    protected IEnumerable<IEvent> ConsumeDomainEvents()
    {
        var events = _domainEvents.ToList();
        _domainEvents.Clear();
        return events;
    }

    public void ClearDomainEvents() => _domainEvents.Clear();
}
