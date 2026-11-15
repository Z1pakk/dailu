using Habit.Domain.ValueObjects;

namespace Habit.UnitTests.Domain.ValueObjects;

public sealed class TimingTests
{
    [Fact]
    public void Create_NoTimeNoDuration_IsAnyTime()
    {
        var result = Timing.Create(null, null);

        result.IsSuccess.ShouldBeTrue();
        result.Value.HasTime.ShouldBeFalse();
        result.Value.At.ShouldBeNull();
        result.Value.DurationMinutes.ShouldBeNull();
    }

    [Fact]
    public void Create_DurationOnly_Succeeds()
    {
        var result = Timing.Create(null, 30);

        result.IsSuccess.ShouldBeTrue();
        result.Value.HasTime.ShouldBeFalse();
        result.Value.DurationMinutes.ShouldBe(30);
    }

    [Fact]
    public void Create_TimeAndDuration_Succeeds()
    {
        var result = Timing.Create(new TimeOnly(7, 0), 45);

        result.IsSuccess.ShouldBeTrue();
        result.Value.HasTime.ShouldBeTrue();
        result.Value.At.ShouldBe(new TimeOnly(7, 0));
        result.Value.DurationMinutes.ShouldBe(45);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(1441)]
    public void Create_DurationOutOfRange_Fails(int duration)
    {
        var result = Timing.Create(null, duration);

        result.IsFailure.ShouldBeTrue();
    }

    [Theory]
    [InlineData(1)]
    [InlineData(1440)]
    public void Create_DurationAtBounds_Succeeds(int duration)
    {
        var result = Timing.Create(null, duration);

        result.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public void Create_DropsSeconds()
    {
        var result = Timing.Create(new TimeOnly(7, 30, 59), null);

        result.Value!.At.ShouldBe(new TimeOnly(7, 30));
    }

    [Fact]
    public void Create_PastMidnight_Fails()
    {
        var result = Timing.Create(new TimeOnly(23, 30), 45);

        result.IsFailure.ShouldBeTrue();
    }

    [Fact]
    public void Create_EndingExactlyAtMidnight_Succeeds()
    {
        var result = Timing.Create(new TimeOnly(23, 15), 45);

        result.IsSuccess.ShouldBeTrue();
    }
}
