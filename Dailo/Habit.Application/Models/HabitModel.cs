using Habit.Domain.Enums;
using StrictId;

namespace Habit.Application.Models;

public class HabitModel
{
    public required Id<HabitModel> Id { get; set; }

    public required string Name { get; set; }

    public string? Description { get; set; }

    public required HabitType Type { get; set; }

    public required FrequencyModel Frequency { get; set; }

    public required TargetModel Target { get; set; }

    public required HabitStatus Status { get; set; }

    public bool IsArchived { get; set; }

    public DateOnly? EndDate { get; set; }

    public MilestoneModel? Milestone { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime? LastCompletedAtUtc { get; set; }

    public IEnumerable<TagModel> Tags { get; set; } = [];
}
