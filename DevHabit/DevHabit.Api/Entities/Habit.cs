namespace DevHabit.Api.Entities;

public sealed class Habit
{
    public required string Id { get; set; }

    public string UserId { get; set; }

    public required string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public required HabitType Type { get; set; }

    public required Frequency Frequency { get; set; }

    public required Target Target { get; set; }

    public required HabitStatus Status { get; set; }

    public bool IsArchived { get; set; }
    public DateOnly? EndDAte { get; set; }

    public Milestone? Milestone { get; set; }

    public required DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public DateTime? LastCompletedAtUtc { get; set; }

    public List<HabitTag> HabitTags { get; set; } = [];
    public List<Tag> Tags { get; set; } = [];
}
