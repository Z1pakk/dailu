using SharedKernel.ResultPattern;

namespace Habit.Domain.ValueObjects;

public sealed record Milestone
{
    public int Target { get; private set; }
    public int Current { get; private set; }

    private Milestone() { }

    private Milestone(int target, int current)
    {
        Target = target;
        Current = current;
    }

    public static Result<Milestone> Create(int target, int current)
    {
        if (target <= 0)
        {
            return Result<Milestone>.BadRequest("Milestone target must be greater than zero.");
        }

        if (current < 0)
        {
            return Result<Milestone>.BadRequest("Milestone current must not be negative.");
        }

        if (current > target)
        {
            return Result<Milestone>.BadRequest("Milestone current must not exceed target.");
        }

        return Result<Milestone>.Success(new Milestone(target, current));
    }
}
