namespace Search.Domain.Enums;

public enum SearchEntityType
{
    // EntityId = habit id; Text = name (+ description)
    Habit = 1,

    // EntityId = tag id; Text = name
    Tag = 2,

    // EntityId = habit entry id;  Text = the note; HabitId + OccurredAtUtc set
    HabitEntry = 3,
}
