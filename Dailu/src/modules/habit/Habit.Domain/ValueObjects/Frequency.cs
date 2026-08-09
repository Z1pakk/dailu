using Habit.Domain.Enums;
using SharedKernel.ResultPattern;

namespace Habit.Domain.ValueObjects;

public sealed record Frequency
{
    public FrequencyType Type { get; private set; }
    public int TimesPerPeriod { get; private set; }

    private Frequency() { }

    private Frequency(FrequencyType type, int timesPerPeriod)
    {
        Type = type;
        TimesPerPeriod = timesPerPeriod;
    }

    public static Result<Frequency> Create(FrequencyType type, int timesPerPeriod)
    {
        if (timesPerPeriod <= 0)
        {
            return Result<Frequency>.BadRequest("TimesPerPeriod must be greater than zero.");
        }

        return Result<Frequency>.Success(new Frequency(type, timesPerPeriod));
    }
}
