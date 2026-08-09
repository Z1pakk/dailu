using StrictId;

namespace Tag.Application.Models;

public sealed class TagModel
{
    public required Id<TagModel> Id { get; set; }

    public required string Name { get; set; }

    public string? Description { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime? LastModifiedAtUtc { get; set; }
}
