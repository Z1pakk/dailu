namespace DevHabit.Api.Entities;

public sealed class Habit
{
    public required string Id { get; set; }

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

public enum HabitType
{
    None = 0,
    Binary = 1,
    Measurable = 2,
}

public enum HabitStatus
{
    None = 0,
    Ongoing = 1,
    Completed = 2,
}

public sealed class Frequency
{
    public required FrequencyType Type { get; set; }

    public required int TimesPerPeriod { get; set; }
}

public enum FrequencyType
{
    None = 0,
    Daily,
    Weekly,
    Monthly,
}

public sealed class Target
{
    public required int Value { get; set; }

    public required string Unit { get; set; }
}

public sealed class Milestone
{
    public required int Target { get; set; }
    public required int Current { get; set; }
}
