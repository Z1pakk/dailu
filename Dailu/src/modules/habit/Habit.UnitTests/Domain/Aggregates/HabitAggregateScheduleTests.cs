using System.Globalization;
using Habit.Domain.Aggregates;
using Habit.Domain.Entities;
using Habit.Domain.Enums;
using Habit.Domain.ValueObjects;
using StrictId;

namespace Habit.UnitTests.Domain.Aggregates;

public sealed class HabitAggregateScheduleTests
{
    private static HabitAggregateCreateRequest CreateRequest(
        FrequencyType frequencyType = FrequencyType.Daily,
        WeekDays weekDays = WeekDays.None,
        int[]? monthDays = null,
        int timesPerPeriod = 1,
        TimeOnly? at = null,
        int? durationMinutes = null
    ) =>
        new(
            Id: Id<HabitAggregate>.NewId(),
            UserId: Guid.NewGuid(),
            Name: "Run",
            Description: null,
            Type: HabitType.Binary,
            FrequencyType: frequencyType,
            WeekDays: weekDays,
            MonthDays: monthDays ?? [],
            TimesPerPeriod: timesPerPeriod,
            At: at,
            DurationMinutes: durationMinutes,
            TargetValue: 1,
            TargetUnit: "times",
            EndDate: null,
            MilestoneTarget: null,
            MilestoneCurrent: null,
            TagIds: new HashSet<Id>(),
            ExistingTagIds: new HashSet<Id>(),
            LastCompletedAtUtc: null
        );

    private static HabitAggregateUpdateRequest UpdateRequest(
        FrequencyType frequencyType = FrequencyType.Daily,
        WeekDays weekDays = WeekDays.None,
        int[]? monthDays = null,
        int timesPerPeriod = 1,
        TimeOnly? at = null,
        int? durationMinutes = null
    ) =>
        new(
            Name: "Run",
            Description: null,
            Type: HabitType.Binary,
            FrequencyType: frequencyType,
            WeekDays: weekDays,
            MonthDays: monthDays ?? [],
            TimesPerPeriod: timesPerPeriod,
            At: at,
            DurationMinutes: durationMinutes,
            TargetValue: 1,
            TargetUnit: "times",
            EndDate: null,
            MilestoneTarget: null,
            MilestoneCurrent: null,
            TagIds: new HashSet<Id>(),
            ExistingTagIds: new HashSet<Id>(),
            AutomationSource: null
        );

    private static HabitAggregate Restore(
        Frequency? frequency = null,
        DateTime? createdAtUtc = null,
        DateOnly? endDate = null,
        HabitStatus status = HabitStatus.Ongoing,
        bool isArchived = false
    ) =>
        HabitAggregate.Restore(
            new HabitAggregateRestoreRequest(
                Id: Id<HabitAggregate>.NewId(),
                UserId: Guid.NewGuid(),
                Name: "Run",
                Description: null,
                Type: HabitType.Binary,
                Frequency: frequency
                    ?? Frequency.Create(FrequencyType.Daily, WeekDays.None, MonthDays.None).Value!,
                Timing: Timing.Create(null, null).Value!,
                CreatedAtUtc: createdAtUtc ?? new DateTime(2026, 11, 1, 12, 0, 0, DateTimeKind.Utc),
                Target: Target.Create(1, "times").Value!,
                Status: status,
                IsArchived: isArchived,
                EndDate: endDate,
                Milestone: null,
                LastCompletedAtUtc: null,
                Tags: Array.Empty<HabitTagEntity>(),
                Version: Guid.NewGuid(),
                AutomationSource: null,
                AutomationFilter: null
            )
        );

    // ── Create: schedule building ─────────────────────────────────────────

    [Fact]
    public void Create_WeeklyWithDaysAndTime_SavesSchedule()
    {
        var result = HabitAggregate.Create(
            CreateRequest(
                FrequencyType.Weekly,
                WeekDays.Monday | WeekDays.Wednesday | WeekDays.Friday,
                at: new TimeOnly(7, 0),
                durationMinutes: 45
            )
        );

        result.IsSuccess.ShouldBeTrue();
        var entity = result.Value.ToEntity();
        entity.Frequency.Type.ShouldBe(FrequencyType.Weekly);
        entity.Frequency.WeekDays.ShouldBe(WeekDays.Monday | WeekDays.Wednesday | WeekDays.Friday);
        entity.Timing.At.ShouldBe(new TimeOnly(7, 0));
        entity.Timing.DurationMinutes.ShouldBe(45);
    }

    [Fact]
    public void Create_MonthlyWithDays_SavesMonthDays()
    {
        var result = HabitAggregate.Create(CreateRequest(FrequencyType.Monthly, monthDays: [1, 15]));

        result.IsSuccess.ShouldBeTrue();
        result.Value.ToEntity().Frequency.MonthDays.ToDays().ShouldBe([1, 15]);
    }

    [Fact]
    public void Create_NoTiming_IsAnyTime()
    {
        var result = HabitAggregate.Create(CreateRequest());

        result.IsSuccess.ShouldBeTrue();
        result.Value.ToEntity().Timing.ShouldNotBeNull();
        result.Value.ToEntity().Timing.HasTime.ShouldBeFalse();
    }

    [Theory]
    [InlineData(FrequencyType.Weekly)]
    [InlineData(FrequencyType.Monthly)]
    public void Create_TimeWithoutFixedDays_Fails(FrequencyType type)
    {
        var result = HabitAggregate.Create(CreateRequest(type, at: new TimeOnly(7, 0)));

        result.IsFailure.ShouldBeTrue();
    }

    [Theory]
    [InlineData(FrequencyType.Weekly)]
    [InlineData(FrequencyType.Monthly)]
    public void Create_DurationWithoutFixedDays_Succeeds(FrequencyType type)
    {
        var result = HabitAggregate.Create(CreateRequest(type, durationMinutes: 30));

        result.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public void Create_DailyWithTime_Succeeds()
    {
        var result = HabitAggregate.Create(CreateRequest(at: new TimeOnly(7, 0)));

        result.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public void Create_InvalidMonthDay_Fails()
    {
        var result = HabitAggregate.Create(CreateRequest(FrequencyType.Monthly, monthDays: [32]));

        result.IsFailure.ShouldBeTrue();
    }

    [Fact]
    public void Create_WeekDaysOnMonthly_Fails()
    {
        var result = HabitAggregate.Create(CreateRequest(FrequencyType.Monthly, WeekDays.Monday));

        result.IsFailure.ShouldBeTrue();
    }

    [Fact]
    public void Create_PastMidnight_Fails()
    {
        var result = HabitAggregate.Create(CreateRequest(at: new TimeOnly(23, 30), durationMinutes: 45));

        result.IsFailure.ShouldBeTrue();
    }

    [Fact]
    public void Create_TimesWithoutDaysAndDuration_SavesTimes()
    {
        var result = HabitAggregate.Create(
            CreateRequest(FrequencyType.Weekly, timesPerPeriod: 2, durationMinutes: 30)
        );

        result.IsSuccess.ShouldBeTrue();
        var entity = result.Value.ToEntity();
        entity.Frequency.TimesPerPeriod.ShouldBe(2);
        entity.Frequency.WeekDays.ShouldBe(WeekDays.None);
        entity.Timing.DurationMinutes.ShouldBe(30);
        entity.Timing.HasTime.ShouldBeFalse();
    }

    [Fact]
    public void Create_TimesWithoutDaysAndTime_Fails()
    {
        var result = HabitAggregate.Create(
            CreateRequest(FrequencyType.Weekly, timesPerPeriod: 2, at: new TimeOnly(7, 0))
        );

        result.IsFailure.ShouldBeTrue();
    }

    [Fact]
    public void Create_TimesWithPickedDays_Fails()
    {
        var result = HabitAggregate.Create(
            CreateRequest(FrequencyType.Weekly, WeekDays.Monday, timesPerPeriod: 2)
        );

        result.IsFailure.ShouldBeTrue();
    }

    // ── Update: schedule building ─────────────────────────────────────────

    [Fact]
    public void Update_ChangesFrequencyAndTiming()
    {
        var habit = Restore();

        var result = habit.Update(
            UpdateRequest(FrequencyType.Weekly, WeekDays.Tuesday, at: new TimeOnly(18, 0), durationMinutes: 60)
        );

        result.IsSuccess.ShouldBeTrue();
        var entity = habit.ToEntity();
        entity.Frequency.WeekDays.ShouldBe(WeekDays.Tuesday);
        entity.Timing.At.ShouldBe(new TimeOnly(18, 0));
        entity.Timing.DurationMinutes.ShouldBe(60);
    }

    [Fact]
    public void Update_ChangesTimesPerPeriod()
    {
        var habit = Restore();

        var result = habit.Update(UpdateRequest(FrequencyType.Monthly, timesPerPeriod: 3));

        result.IsSuccess.ShouldBeTrue();
        habit.ToEntity().Frequency.TimesPerPeriod.ShouldBe(3);
    }

    [Fact]
    public void Update_TimeWithoutFixedDays_FailsAndKeepsSchedule()
    {
        var habit = Restore();

        var result = habit.Update(UpdateRequest(FrequencyType.Weekly, at: new TimeOnly(7, 0)));

        result.IsFailure.ShouldBeTrue();
        habit.ToEntity().Frequency.Type.ShouldBe(FrequencyType.Daily);
    }

    // ── IsScheduledOn ─────────────────────────────────────────────────────

    [Fact]
    public void IsScheduledOn_BeforeCreation_False()
    {
        var habit = Restore(createdAtUtc: new DateTime(2026, 11, 10, 8, 0, 0, DateTimeKind.Utc));

        habit.IsScheduledOn(new DateOnly(2026, 11, 9)).ShouldBeFalse();
        habit.IsScheduledOn(new DateOnly(2026, 11, 10)).ShouldBeTrue();
    }

    [Fact]
    public void IsScheduledOn_AfterEndDate_False()
    {
        var habit = Restore(endDate: new DateOnly(2026, 11, 20));

        habit.IsScheduledOn(new DateOnly(2026, 11, 20)).ShouldBeTrue();
        habit.IsScheduledOn(new DateOnly(2026, 11, 21)).ShouldBeFalse();
    }

    [Fact]
    public void IsScheduledOn_Completed_False()
    {
        var habit = Restore(status: HabitStatus.Completed);

        habit.IsScheduledOn(new DateOnly(2026, 11, 16)).ShouldBeFalse();
    }

    [Fact]
    public void IsScheduledOn_Archived_False()
    {
        var habit = Restore(isArchived: true);

        habit.IsScheduledOn(new DateOnly(2026, 11, 16)).ShouldBeFalse();
    }

    [Theory]
    [InlineData("2026-11-16", true)] // Mon
    [InlineData("2026-11-17", false)] // Tue
    [InlineData("2026-11-18", true)] // Wed
    public void IsScheduledOn_FollowsFrequency(string date, bool expected)
    {
        var frequency = Frequency
            .Create(FrequencyType.Weekly, WeekDays.Monday | WeekDays.Wednesday, MonthDays.None)
            .Value!;
        var habit = Restore(frequency);

        habit.IsScheduledOn(DateOnly.Parse(date, CultureInfo.InvariantCulture)).ShouldBe(expected);
    }
}
