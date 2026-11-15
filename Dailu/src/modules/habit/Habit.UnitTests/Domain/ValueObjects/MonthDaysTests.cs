using System.Globalization;
using Habit.Domain.ValueObjects;

namespace Habit.UnitTests.Domain.ValueObjects;

public sealed class MonthDaysTests
{
    [Theory]
    [InlineData(0)]
    [InlineData(32)]
    [InlineData(-1)]
    public void Create_DayOutOfRange_Fails(int day)
    {
        var result = MonthDays.Create([day]);

        result.IsFailure.ShouldBeTrue();
    }

    [Fact]
    public void Create_NoDays_IsEmpty()
    {
        var result = MonthDays.Create([]);

        result.IsSuccess.ShouldBeTrue();
        result.Value.IsEmpty.ShouldBeTrue();
        result.Value.ShouldBe(MonthDays.None);
    }

    [Fact]
    public void Create_DuplicateDays_KeepsDayOnce()
    {
        var result = MonthDays.Create([1, 1]);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ToDays().ShouldBe([1]);
    }

    [Fact]
    public void ToDays_ReturnsSortedPickedDays()
    {
        var days = MonthDays.Create([31, 1, 15]).Value;

        days.ToDays().ShouldBe([1, 15, 31]);
    }

    [Fact]
    public void FromBits_RoundTripsBits()
    {
        var days = MonthDays.Create([1, 15, 31]).Value;

        MonthDays.FromBits(days.Bits).ShouldBe(days);
    }

    [Fact]
    public void FromBits_MasksStrayBit()
    {
        var days = MonthDays.FromBits(int.MinValue | 1);

        days.ToDays().ShouldBe([1]);
    }

    [Theory]
    [InlineData(new int[0], 0)]
    [InlineData(new[] { 1 }, 1)]
    [InlineData(new[] { 1, 15 }, 15)]
    [InlineData(new[] { 29, 31 }, 31)]
    public void Highest_ReturnsHighestPickedDay(int[] picked, int expected)
    {
        var days = MonthDays.Create(picked).Value;

        days.Highest.ShouldBe(expected);
    }

    [Theory]
    [InlineData(new[] { 1, 15 }, "2026-03-01", true)]
    [InlineData(new[] { 1, 15 }, "2026-03-15", true)]
    [InlineData(new[] { 1, 15 }, "2026-03-02", false)]
    // A picked day the month doesn't have falls on its last day.
    [InlineData(new[] { 31 }, "2026-11-30", true)]
    [InlineData(new[] { 31 }, "2026-11-29", false)]
    [InlineData(new[] { 31 }, "2026-12-31", true)]
    [InlineData(new[] { 31 }, "2026-12-30", false)]
    [InlineData(new[] { 30 }, "2026-02-28", true)]
    [InlineData(new[] { 29 }, "2026-02-28", true)]
    [InlineData(new[] { 29 }, "2028-02-28", false)]
    [InlineData(new[] { 29 }, "2028-02-29", true)]
    // Days that do exist in the month don't move.
    [InlineData(new[] { 28 }, "2026-02-28", true)]
    [InlineData(new[] { 15 }, "2026-02-28", false)]
    public void Matches_FollowsShortMonthRule(int[] picked, string date, bool expected)
    {
        var days = MonthDays.Create(picked).Value;

        days.Matches(DateOnly.Parse(date, CultureInfo.InvariantCulture)).ShouldBe(expected);
    }
}
