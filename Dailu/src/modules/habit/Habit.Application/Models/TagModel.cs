using StrictId;

namespace Habit.Application.Models;

public record TagModel(Id<TagModel> Id, string Name, string? Description);
