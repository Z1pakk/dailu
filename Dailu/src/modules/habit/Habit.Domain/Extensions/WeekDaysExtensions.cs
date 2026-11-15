using Habit.Domain.Enums;

namespace Habit.Domain.Extensions;

public static class WeekDaysExtensions
{
    // DayOfWeek.Monday → WeekDays.Monday
    public static WeekDays ToWeekDays(this DayOfWeek day) => (WeekDays)(1 << (int)day);

    // API input: [1, 3, 5] → Monday | Wednesday | Friday
    public static WeekDays ToWeekDays(this IEnumerable<DayOfWeek> days) =>
        days.Aggregate(WeekDays.None, (all, day) => all | day.ToWeekDays());

    // Frequency.Matches: "is Wednesday picked?"
    public static bool Contains(this WeekDays days, DayOfWeek day) =>
        (days & day.ToWeekDays()) != 0;

    // API output: Monday | Friday → [Monday, Friday]
    public static IReadOnlyList<DayOfWeek> ToDaysOfWeek(this WeekDays days) =>
        Enum.GetValues<DayOfWeek>().Where(dayOfWeek => days.Contains(dayOfWeek)).ToList();
}
