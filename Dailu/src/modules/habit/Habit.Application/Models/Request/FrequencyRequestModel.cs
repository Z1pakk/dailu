using Habit.Domain.Enums;

namespace Habit.Application.Models.Request;

public sealed record FrequencyRequestModel(
    FrequencyType Type,
    IReadOnlyList<DayOfWeek>? WeekDays = null,
    IReadOnlyList<int>? MonthDays = null,
    int TimesPerPeriod = 1
);
