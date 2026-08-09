namespace Habit.Domain.ValueObjects.AutomationFilters;

public sealed record GoogleHealthAutomationFilter(GoogleHealthMetric[] Metrics)
    : HabitAutomationFilter;

public enum GoogleHealthMetric
{
    Steps = 0,
    Exercise = 1,
}
