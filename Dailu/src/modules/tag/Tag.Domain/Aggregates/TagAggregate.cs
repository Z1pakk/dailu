using Dailu.Events;
using SharedKernel.ResultPattern;
using StrictId;
using Tag.Domain.Entities;

namespace Tag.Domain.Aggregates;

public sealed class TagAggregate : Aggregate
{
    private Id<TagAggregate> Id { get; set; }

    private Guid UserId { get; set; }

    private string Name { get; set; } = string.Empty;

    private string? Description { get; set; }

    private TagAggregate() { }

    public static Result<TagAggregate> Create(Guid userId, string name, string? description)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result<TagAggregate>.BadRequest("Tag name must not be empty.");
        }

        var aggregate = new TagAggregate
        {
            Id = Id<TagAggregate>.NewId(),
            UserId = userId,
            Name = name.Trim(),
            Description = description?.Trim(),
        };

        aggregate.RaiseDomainEvent(
            new TagNameChangedIntegrationEvent(
                aggregate.Id.ToId(),
                aggregate.UserId,
                aggregate.Name
            )
        );

        return Result<TagAggregate>.Success(aggregate);
    }

    internal static TagAggregate Restore(TagEntity entity) =>
        new()
        {
            Id = entity.Id.ToId(),
            UserId = entity.UserId,
            Name = entity.Name,
            Description = entity.Description,
        };

    public TagEntity ToEntity()
    {
        var entity = new TagEntity()
        {
            Id = Id.ToId(),
            UserId = UserId,
            Name = Name,
            Description = Description,
        };

        entity.AddDomainEvent(ConsumeDomainEvents());

        return entity;
    }
}
