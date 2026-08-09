using Tag.Domain.Entities;
using SharedKernel.ResultPattern;
using StrictId;

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

        return Result<TagAggregate>.Success(
            new TagAggregate
            {
                Id = Id<TagAggregate>.NewId(),
                UserId = userId,
                Name = name.Trim(),
                Description = description?.Trim(),
            }
        );
    }

    internal static TagAggregate Restore(TagEntity entity) =>
        new()
        {
            Id = entity.Id.ToId(),
            UserId = entity.UserId,
            Name = entity.Name,
            Description = entity.Description,
        };

    public TagEntity ToEntity() =>
        new()
        {
            Id = Id.ToId(),
            UserId = UserId,
            Name = Name,
            Description = Description,
        };
}
