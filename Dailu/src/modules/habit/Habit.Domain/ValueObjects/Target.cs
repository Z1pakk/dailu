using SharedKernel.ResultPattern;

namespace Habit.Domain.ValueObjects;

public sealed record Target
{
    public int Value { get; private set; }
    public string Unit { get; private set; } = string.Empty;

    private Target() { }

    private Target(int value, string unit)
    {
        Value = value;
        Unit = unit;
    }

    public static Result<Target> Create(int value, string unit)
    {
        if (value <= 0)
        {
            return Result<Target>.BadRequest("Target value must be greater than zero.");
        }

        if (string.IsNullOrWhiteSpace(unit))
        {
            return Result<Target>.BadRequest("Target unit must not be empty.");
        }

        return Result<Target>.Success(new Target(value, unit.Trim()));
    }
}
