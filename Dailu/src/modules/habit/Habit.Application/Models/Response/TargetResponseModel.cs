using Habit.Domain.ValueObjects;

namespace Habit.Application.Models.Response;

public sealed record TargetResponseModel(int Value, string Unit)
{
    public static TargetResponseModel FromDomain(Target target) => new(target.Value, target.Unit);
}
