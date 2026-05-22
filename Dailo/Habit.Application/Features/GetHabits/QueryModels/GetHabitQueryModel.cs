using Habit.Domain.Entities;
using Habit.Domain.Enums;
using Habit.Domain.ValueObjects;
using StrictId;

namespace Habit.Application.Features.GetHabits.QueryModels;

public class GetHabitQueryModel
{
    public required Id<HabitEntity> Id { get; set; }

    public required string Name { get; set; }

    public string? Description { get; set; }

    public required HabitType Type { get; set; }

    public required Frequency Frequency { get; set; }

    public required Target Target { get; set; }

    public required HabitStatus Status { get; set; }

    public bool IsArchived { get; set; }

    public DateOnly? EndDate { get; set; }

    public Milestone? Milestone { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public AutomationSource? AutomationSource { get; set; }

    public DateTime? LastCompletedAtUtc { get; set; }

    public List<Id> TagIds { get; set; } = [];
}
