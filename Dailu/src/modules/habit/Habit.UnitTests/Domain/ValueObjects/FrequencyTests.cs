using System.Globalization;
using Habit.Domain.Enums;
using Habit.Domain.ValueObjects;

namespace Habit.UnitTests.Domain.ValueObjects;

public sealed class FrequencyTests
{
    private static MonthDays Days(params int[] days) => MonthDays.Create(days).Value;

    private static Frequency Create(FrequencyType type, WeekDays weekDays, MonthDays monthDays) =>
        Frequency.Create(type, weekDays, monthDays).Value!;

    [Fact]
    public void Create_NoType_Fails()
    {
        var result = Frequency.Create(FrequencyType.None, WeekDays.None, MonthDays.None);

        result.IsFailure.ShouldBeTrue();
    }

    [Theory]
    [InlineData(FrequencyType.Daily)]
    [InlineData(FrequencyType.Weekly)]
    [InlineData(FrequencyType.Monthly)]
    public void Create_NoDays_Succeeds(FrequencyType type)
    {
        var result = Frequency.Create(type, WeekDays.None, MonthDays.None);

        result.IsSuccess.ShouldBeTrue();
    }

    [Theory]
    [InlineData(FrequencyType.Daily)]
    [InlineData(FrequencyType.Monthly)]
    public void Create_WeekDaysOnNonWeekly_Fails(FrequencyType type)
    {
        var result = Frequency.Create(type, WeekDays.Monday, MonthDays.None);

        result.IsFailure.ShouldBeTrue();
    }

    [Theory]
    [InlineData(FrequencyType.Daily)]
    [InlineData(FrequencyType.Weekly)]
    public void Create_MonthDaysOnNonMonthly_Fails(FrequencyType type)
    {
        var result = Frequency.Create(type, WeekDays.None, Days(15));

        result.IsFailure.ShouldBeTrue();
    }

    [Fact]
    public void Create_KeepsPickedDays()
    {
        var weekly = Create(FrequencyType.Weekly, WeekDays.Monday | WeekDays.Friday, MonthDays.None);
        var monthly = Create(FrequencyType.Monthly, WeekDays.None, Days(1, 15));

        weekly.WeekDays.ShouldBe(WeekDays.Monday | WeekDays.Friday);
        monthly.MonthDays.ToDays().ShouldBe([1, 15]);
    }

    [Fact]
    public void Create_TimesPerPeriod_DefaultsToOne()
    {
        Create(FrequencyType.Weekly, WeekDays.None, MonthDays.None).TimesPerPeriod.ShouldBe(1);
    }

    [Theory]
    [InlineData(FrequencyType.Weekly, 2)]
    [InlineData(FrequencyType.Weekly, 7)]
    [InlineData(FrequencyType.Monthly, 3)]
    [InlineData(FrequencyType.Monthly, 31)]
    public void Create_TimesWithoutDays_Succeeds(FrequencyType type, int times)
    {
        var result = Frequency.Create(type, WeekDays.None, MonthDays.None, times);

        result.IsSuccess.ShouldBeTrue();
        result.Value.TimesPerPeriod.ShouldBe(times);
    }

    [Theory]
    [InlineData(FrequencyType.Weekly, 0)]
    [InlineData(FrequencyType.Weekly, -1)]
    [InlineData(FrequencyType.Weekly, 8)]
    [InlineData(FrequencyType.Monthly, 32)]
    public void Create_TimesOutOfRange_Fails(FrequencyType type, int times)
    {
        var result = Frequency.Create(type, WeekDays.None, MonthDays.None, times);

        result.IsFailure.ShouldBeTrue();
    }

    [Fact]
    public void Create_TimesOnDaily_Fails()
    {
        var result = Frequency.Create(FrequencyType.Daily, WeekDays.None, MonthDays.None, 2);

        result.IsFailure.ShouldBeTrue();
    }

    [Fact]
    public void Create_TimesWithPickedDays_Fails()
    {
        var weekly = Frequency.Create(FrequencyType.Weekly, WeekDays.Monday, MonthDays.None, 2);
        var monthly = Frequency.Create(FrequencyType.Monthly, WeekDays.None, Days(1), 2);

        weekly.IsFailure.ShouldBeTrue();
        monthly.IsFailure.ShouldBeTrue();
    }

    [Fact]
    public void Create_OneTimeWithPickedDays_Succeeds()
    {
        var result = Frequency.Create(FrequencyType.Weekly, WeekDays.Monday, MonthDays.None, 1);

        result.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public void Matches_TimesWithoutDays_StillAnyDay()
    {
        var frequency = Frequency.Create(FrequencyType.Weekly, WeekDays.None, MonthDays.None, 2).Value!;

        frequency.Matches(new DateOnly(2026, 11, 17)).ShouldBeTrue();
        frequency.HasFixedDays.ShouldBeFalse();
    }

    [Fact]
    public void HasFixedDays_DailyOrPickedDays()
    {
        Create(FrequencyType.Daily, WeekDays.None, MonthDays.None).HasFixedDays.ShouldBeTrue();
        Create(FrequencyType.Weekly, WeekDays.Monday, MonthDays.None).HasFixedDays.ShouldBeTrue();
        Create(FrequencyType.Monthly, WeekDays.None, Days(1)).HasFixedDays.ShouldBeTrue();

        Create(FrequencyType.Weekly, WeekDays.None, MonthDays.None).HasFixedDays.ShouldBeFalse();
        Create(FrequencyType.Monthly, WeekDays.None, MonthDays.None).HasFixedDays.ShouldBeFalse();
    }

    [Theory]
    // 2026-11-16 is a Monday.
    [InlineData("2026-11-16")]
    [InlineData("2026-11-21")]
    public void Matches_Daily_EveryDay(string date)
    {
        var frequency = Create(FrequencyType.Daily, WeekDays.None, MonthDays.None);

        frequency.Matches(DateOnly.Parse(date, CultureInfo.InvariantCulture)).ShouldBeTrue();
    }

    [Theory]
    [InlineData("2026-11-16", true)] // Mon
    [InlineData("2026-11-17", false)] // Tue
    [InlineData("2026-11-18", true)] // Wed
    [InlineData("2026-11-20", true)] // Fri
    [InlineData("2026-11-22", false)] // Sun
    public void Matches_WeeklyWithDays_OnlyPickedDays(string date, bool expected)
    {
        var frequency = Create(
            FrequencyType.Weekly,
            WeekDays.Monday | WeekDays.Wednesday | WeekDays.Friday,
            MonthDays.None
        );

        frequency.Matches(DateOnly.Parse(date, CultureInfo.InvariantCulture)).ShouldBe(expected);
    }

    [Fact]
    public void Matches_WeeklyWeekdays_SkipsWeekend()
    {
        var frequency = Create(FrequencyType.Weekly, WeekDays.Weekdays, MonthDays.None);

        frequency.Matches(new DateOnly(2026, 11, 20)).ShouldBeTrue(); // Fri
        frequency.Matches(new DateOnly(2026, 11, 21)).ShouldBeFalse(); // Sat
    }

    [Theory]
    [InlineData(FrequencyType.Weekly)]
    [InlineData(FrequencyType.Monthly)]
    public void Matches_NoDays_AnyDay(FrequencyType type)
    {
        var frequency = Create(type, WeekDays.None, MonthDays.None);

        frequency.Matches(new DateOnly(2026, 11, 17)).ShouldBeTrue();
        frequency.Matches(new DateOnly(2026, 11, 30)).ShouldBeTrue();
    }

    [Theory]
    [InlineData("2026-11-01", true)]
    [InlineData("2026-11-15", true)]
    [InlineData("2026-11-16", false)]
    public void Matches_MonthlyWithDays_OnlyPickedDays(string date, bool expected)
    {
        var frequency = Create(FrequencyType.Monthly, WeekDays.None, Days(1, 15));

        frequency.Matches(DateOnly.Parse(date, CultureInfo.InvariantCulture)).ShouldBe(expected);
    }

    [Fact]
    public void Matches_Monthly31st_FallsOnLastDayOfShortMonth()
    {
        var frequency = Create(FrequencyType.Monthly, WeekDays.None, Days(31));

        frequency.Matches(new DateOnly(2026, 11, 30)).ShouldBeTrue();
        frequency.Matches(new DateOnly(2026, 2, 28)).ShouldBeTrue();
        frequency.Matches(new DateOnly(2026, 12, 30)).ShouldBeFalse();
    }
}
