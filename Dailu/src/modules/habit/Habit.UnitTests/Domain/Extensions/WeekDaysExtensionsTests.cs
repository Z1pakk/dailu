using Habit.Domain.Enums;
using Habit.Domain.Extensions;

namespace Habit.UnitTests.Domain.Extensions;

public sealed class WeekDaysExtensionsTests
{
    [Theory]
    [InlineData(DayOfWeek.Sunday, WeekDays.Sunday)]
    [InlineData(DayOfWeek.Monday, WeekDays.Monday)]
    [InlineData(DayOfWeek.Saturday, WeekDays.Saturday)]
    public void ToWeekDays_SingleDay_MapsToFlag(DayOfWeek day, WeekDays expected)
    {
        day.ToWeekDays().ShouldBe(expected);
    }

    [Fact]
    public void ToWeekDays_Days_CombinesFlags()
    {
        var days = new[] { DayOfWeek.Monday, DayOfWeek.Wednesday, DayOfWeek.Friday };

        days.ToWeekDays().ShouldBe(WeekDays.Monday | WeekDays.Wednesday | WeekDays.Friday);
    }

    [Fact]
    public void ToWeekDays_NoDays_IsNone()
    {
        Array.Empty<DayOfWeek>().ToWeekDays().ShouldBe(WeekDays.None);
    }

    [Fact]
    public void ToWeekDays_MondayToFriday_IsWeekdays()
    {
        var days = new[]
        {
            DayOfWeek.Monday,
            DayOfWeek.Tuesday,
            DayOfWeek.Wednesday,
            DayOfWeek.Thursday,
            DayOfWeek.Friday,
        };

        days.ToWeekDays().ShouldBe(WeekDays.Weekdays);
    }

    [Fact]
    public void Contains_ChecksDay()
    {
        var days = WeekDays.Monday | WeekDays.Friday;

        days.Contains(DayOfWeek.Monday).ShouldBeTrue();
        days.Contains(DayOfWeek.Tuesday).ShouldBeFalse();
    }

    [Fact]
    public void ToDaysOfWeek_ReturnsPickedDays()
    {
        var days = (WeekDays.Friday | WeekDays.Monday).ToDaysOfWeek();

        days.ShouldBe(new[] { DayOfWeek.Monday, DayOfWeek.Friday });
    }

    [Fact]
    public void ToDaysOfWeek_RoundTrips()
    {
        var picked = WeekDays.Sunday | WeekDays.Wednesday | WeekDays.Saturday;

        picked.ToDaysOfWeek().ToWeekDays().ShouldBe(picked);
    }
}
