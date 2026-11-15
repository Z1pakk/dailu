using SharedKernel.ResultPattern;

namespace Habit.Domain.ValueObjects;

public sealed record Timing
{
    private const int MinutesPerDay = 24 * 60;

    public TimeOnly? At { get; private set; } // null = any time
    public int? DurationMinutes { get; private set; } // null = no duration

    private Timing() { }

    private Timing(TimeOnly? at, int? durationMinutes)
    {
        At = at;
        DurationMinutes = durationMinutes;
    }

    public bool HasTime => At is not null;

    public static Result<Timing> Create(TimeOnly? at, int? durationMinutes)
    {
        if (durationMinutes is <= 0 or > MinutesPerDay)
        {
            return Result<Timing>.BadRequest(
                "DurationMinutes must be positive and less than or equal to 1440."
            );
        }

        // Minute precision: the picker and the clock never use seconds.
        TimeOnly? start = at is { } time ? new TimeOnly(time.Hour, time.Minute) : null;

        if (
            start is { } s
            && durationMinutes is { } duration
            && s.Hour * 60 + s.Minute + duration > MinutesPerDay
        )
        {
            return Result<Timing>.BadRequest("A timed habit can't run past midnight.");
        }

        return Result<Timing>.Success(new Timing(start, durationMinutes));
    }
}
