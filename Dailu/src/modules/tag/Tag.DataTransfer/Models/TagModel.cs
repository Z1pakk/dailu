using StrictId;

namespace Tag.DataTransfer.Models;

public class TagModel
{
    public Id<TagModel> Id { get; set; }

    public required string Name { get; set; }

    public string? Description { get; set; }
}
