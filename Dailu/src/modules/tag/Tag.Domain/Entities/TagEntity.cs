using Tag.Domain.Aggregates;
using StrictId;

namespace Tag.Domain.Entities;

public sealed class TagEntity : BaseEntity<Id<TagEntity>>
{
    public Guid UserId { get; set; }

    public required string Name { get; set; }

    public string? Description { get; set; }

    public TagAggregate ToAggregate() => TagAggregate.Restore(this);
}
