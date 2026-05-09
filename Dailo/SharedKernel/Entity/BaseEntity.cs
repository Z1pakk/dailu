using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Domain;
using SharedKernel.Event;

namespace SharedKernel.Entity;

public abstract class BaseEntity<T>
    : IEntity<T>,
        IEntityVersion,
        IAuditableEntity,
        ISoftDeletableEntity,
        IHasDomainEvents
{
    [NotMapped]
    private readonly List<IEvent> _domainEvents = [];

    public required T Id { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public Guid? CreatedByUserId { get; set; }
    public DateTime? LastModifiedAtUtc { get; set; }
    public Guid? LastModifiedByUserId { get; set; }

    public bool IsDeleted { get; set; }

    public Guid Version { get; set; } = Guid.NewGuid();

    [NotMapped]
    public IReadOnlyList<IEvent> DomainEvents => _domainEvents.AsReadOnly();

    public void AddDomainEvent(IEvent domainEvent) => _domainEvents.Add(domainEvent);

    public void ClearDomainEvents() => _domainEvents.Clear();
}
