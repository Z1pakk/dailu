using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Identity;
using SharedKernel.Domain;
using SharedKernel.Entity;
using SharedKernel.Event;

namespace Identity.Domain.Entities;

public class User
    : IdentityUser<Guid>,
        IEntity,
        IEntityVersion,
        IAuditableEntity,
        ISoftDeletableEntity,
        IHasDomainEvents
{
    [NotMapped]
    private readonly List<IEvent> _domainEvents = [];

    public required string FirstName { get; set; }
    public required string LastName { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public DateTime? LastModifiedAtUtc { get; set; }
    public Guid? LastModifiedByUserId { get; set; }

    public bool IsDeleted { get; set; }

    public Guid Version { get; set; }

    public virtual ICollection<RefreshToken> RefreshTokens { get; set; } = [];

    [NotMapped]
    public IReadOnlyList<IEvent> DomainEvents => _domainEvents.AsReadOnly();

    public void AddDomainEvent(IEvent domainEvent) => _domainEvents.Add(domainEvent);

    public void ClearDomainEvents() => _domainEvents.Clear();
}
