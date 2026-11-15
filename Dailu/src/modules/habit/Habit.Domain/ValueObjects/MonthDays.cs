using System.Numerics;
using SharedKernel.ResultPattern;

namespace Habit.Domain.ValueObjects;

public readonly record struct MonthDays
{
    private const int AllBits = 0x7FFF_FFFF; // days 1–31 → bits 0–30

    // days stored in bits to reduce space for it and max here is 31 bit so int should cover it.
    // like first day: 1 << 0 (001 - 1), second day: 1 << 1 (0010 - 2), third day: 1 << 2 (00100 - 4) etc.
    public int Bits { get; }

    private MonthDays(int bits) => Bits = bits;

    public static MonthDays None => default;
    public bool IsEmpty => Bits == 0;

    // API input, validated: anything outside 1–31 → BadRequest.
    public static Result<MonthDays> Create(IEnumerable<int> days)
    {
        int[] daysArray = days.ToArray();

        if (daysArray.Any(d => d < 1 || d > 31))
        {
            return Result<MonthDays>.BadRequest("Days must be between 1 and 31");
        }

        return Result<MonthDays>.Success(
            new MonthDays(daysArray.Aggregate(0, (bits, d) => bits | (1 << (d - 1))))
        );
    }

    // EF converter only: trusts the database, masks stray bits.
    public static MonthDays FromBits(int bits) => new(bits & AllBits);

    public bool Contains(int day) => day is >= 1 and <= 31 && (Bits & (1 << (day - 1))) != 0;

    // Highest picked day, 0 if none.
    public int Highest => IsEmpty ? 0 : 32 - BitOperations.LeadingZeroCount((uint)Bits);

    // API output: [1, 15, 31]
    public IReadOnlyList<int> ToDays() => Enumerable.Range(1, 31).Where(Contains).ToList();

    // The short-month rule: a picked day the month doesn't have falls on its last day.
    public bool Matches(DateOnly date)
    {
        var last = DateTime.DaysInMonth(date.Year, date.Month);
        return Contains(date.Day) || date.Day == last && Highest > last;
    }
}
