using SharedKernel.Event;

namespace SharedKernel.Domain;

public abstract class Aggregate
{
    private readonly List<IDomainEvent> _domainEvents = [];

    public Guid Version { get; protected set; }

    public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    protected void RaiseDomainEvent(IDomainEvent domainEvent) => _domainEvents.Add(domainEvent);

    public void ClearDomainEvents() => _domainEvents.Clear();
}
