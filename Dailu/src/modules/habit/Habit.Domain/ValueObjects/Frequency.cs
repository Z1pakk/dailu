using Habit.Domain.Enums;
using Habit.Domain.Extensions;
using SharedKernel.ResultPattern;

namespace Habit.Domain.ValueObjects;

public sealed record Frequency
{
    private const int MaxPerWeek = 7;
    private const int MaxPerMonth = 31;

    public FrequencyType Type { get; private set; }

    public WeekDays WeekDays { get; private set; } = WeekDays.None; // None = N times a week, any days

    public MonthDays MonthDays { get; private set; } = MonthDays.None; // None = N times a month, any days

    public int TimesPerPeriod { get; private set; } = 1;

    private Frequency() { }

    private Frequency(
        FrequencyType type,
        WeekDays weekDays,
        MonthDays monthDays,
        int timesPerPeriod
    )
    {
        Type = type;
        WeekDays = weekDays;
        MonthDays = monthDays;
        TimesPerPeriod = timesPerPeriod;
    }

    public static Result<Frequency> Create(
        FrequencyType type,
        WeekDays weekDays,
        MonthDays monthDays,
        int timesPerPeriod = 1
    )
    {
        if (type == FrequencyType.None)
        {
            return Result<Frequency>.BadRequest("FrequencyType must be specified.");
        }

        if (type != FrequencyType.Weekly && weekDays != WeekDays.None)
        {
            return Result<Frequency>.BadRequest("Week days can only be picked for a weekly habit.");
        }

        if (type != FrequencyType.Monthly && !monthDays.IsEmpty)
        {
            return Result<Frequency>.BadRequest(
                "Month days can only be picked for a monthly habit."
            );
        }

        if (timesPerPeriod < 1)
        {
            return Result<Frequency>.BadRequest("Times per period must be at least 1.");
        }

        var hasFixedDays =
            type == FrequencyType.Daily || weekDays != WeekDays.None || !monthDays.IsEmpty;
        if (timesPerPeriod > 1 && hasFixedDays)
        {
            return Result<Frequency>.BadRequest(
                "Times per period only applies when no days are picked."
            );
        }

        var max = type == FrequencyType.Weekly ? MaxPerWeek : MaxPerMonth;
        if (timesPerPeriod > max)
        {
            return Result<Frequency>.BadRequest($"At most {max} times per period.");
        }

        return Result<Frequency>.Success(new Frequency(type, weekDays, monthDays, timesPerPeriod));
    }

    // Daily, or Weekly/Monthly with picked days → can have a time, sits on the clock.
    public bool HasFixedDays =>
        Type == FrequencyType.Daily || WeekDays != WeekDays.None || !MonthDays.IsEmpty;

    public bool Matches(DateOnly day) =>
        Type switch
        {
            FrequencyType.Daily => true,
            FrequencyType.Weekly => WeekDays == WeekDays.None || WeekDays.Contains(day.DayOfWeek),
            FrequencyType.Monthly => MonthDays.IsEmpty || MonthDays.Matches(day),
            _ => false,
        };
}
