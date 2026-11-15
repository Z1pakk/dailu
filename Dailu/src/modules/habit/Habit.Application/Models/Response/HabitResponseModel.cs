using Habit.Domain.Enums;
using Habit.Domain.ValueObjects.AutomationFilters;
using StrictId;

namespace Habit.Application.Models.Response;

public sealed record HabitResponseModel
{
    public required Id<HabitResponseModel> Id { get; set; }

    public required string Name { get; set; }

    public string? Description { get; set; }

    public required HabitType Type { get; set; }

    public required FrequencyResponseModel Frequency { get; set; }

    public required TimingResponseModel Timing { get; set; }

    public required TargetResponseModel Target { get; set; }

    public required HabitStatus Status { get; set; }

    public bool IsArchived { get; set; }

    public DateOnly? EndDate { get; set; }

    public MilestoneResponseModel? Milestone { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public AutomationSource? AutomationSource { get; set; }

    public HabitAutomationFilter? AutomationFilter { get; set; }

    public DateTime? LastCompletedAtUtc { get; set; }

    public IEnumerable<TagModel> Tags { get; set; } = [];
}
