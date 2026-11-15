using Habit.Domain.ValueObjects;

namespace Habit.Application.Models.Response;

public sealed record TimingResponseModel(TimeOnly? At, int? DurationMinutes)
{
    public static TimingResponseModel FromDomain(Timing timing) =>
        new(timing.At, timing.DurationMinutes);
}
