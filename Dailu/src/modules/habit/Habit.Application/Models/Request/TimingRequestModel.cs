namespace Habit.Application.Models.Request;

public sealed record TimingRequestModel(TimeOnly? At = null, int? DurationMinutes = null);
