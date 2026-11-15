namespace Habit.Domain.Enums;

[Flags]
public enum WeekDays
{
    None = 0,
    Sunday = 1 << DayOfWeek.Sunday, // 1
    Monday = 1 << DayOfWeek.Monday, // 2
    Tuesday = 1 << DayOfWeek.Tuesday, // 4
    Wednesday = 1 << DayOfWeek.Wednesday, // 8
    Thursday = 1 << DayOfWeek.Thursday, // 16
    Friday = 1 << DayOfWeek.Friday, // 32
    Saturday = 1 << DayOfWeek.Saturday, // 64

    Weekdays = Monday | Tuesday | Wednesday | Thursday | Friday,
    Weekends = Saturday | Sunday,
    All = Weekdays | Weekends,
}
