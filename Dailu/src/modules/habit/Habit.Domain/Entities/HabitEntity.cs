using Habit.Domain.Enums;
using Habit.Domain.ValueObjects;
using Habit.Domain.ValueObjects.AutomationFilters;
using StrictId;

namespace Habit.Domain.Entities;

public sealed class HabitEntity : BaseEntity<Id<HabitEntity>>
{
    public Guid UserId { get; set; }

    public required string Name { get; set; }

    public string? Description { get; set; }

    public required HabitType Type { get; set; }

    public required Frequency Frequency { get; set; }

    public required Target Target { get; set; }

    public required HabitStatus Status { get; set; }

    /// <summary>
    /// User-facing state: the habit is retired but kept, still visible to its owner, with its
    /// history intact. Not filtered automatically; queries decide whether to include it. Unlike
    /// <c>IsDeleted</c>, which hides the row from every query.
    /// </summary>
    public bool IsArchived { get; set; }

    public DateOnly? EndDate { get; set; }

    public Milestone? Milestone { get; set; }

    public AutomationSource? AutomationSource { get; set; }

    public DateTime? LastCompletedAtUtc { get; set; }

    public ICollection<HabitTagEntity> Tags { get; set; } = [];

    public HabitAutomationFilter? AutomationFilter { get; set; }
}
