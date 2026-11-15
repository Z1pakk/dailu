using Habit.Domain.ValueObjects;

namespace Habit.Application.Models.Response;

public sealed record MilestoneResponseModel(int Target, int Current)
{
    public static MilestoneResponseModel FromDomain(Milestone milestone) =>
        new(milestone.Target, milestone.Current);
}
