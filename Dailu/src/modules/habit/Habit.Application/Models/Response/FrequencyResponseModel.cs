using Habit.Domain.Enums;
using Habit.Domain.Extensions;
using Habit.Domain.ValueObjects;

namespace Habit.Application.Models.Response;

public sealed record FrequencyResponseModel(
    FrequencyType Type,
    IReadOnlyList<DayOfWeek> WeekDays,
    IReadOnlyList<int> MonthDays,
    int TimesPerPeriod
)
{
    public static FrequencyResponseModel FromDomain(Frequency frequency) =>
        new(
            frequency.Type,
            frequency.WeekDays.ToDaysOfWeek(),
            frequency.MonthDays.ToDays(),
            frequency.TimesPerPeriod
        );
}
