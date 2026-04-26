using Habit.Domain.Entities;
using Habit.Domain.Enums;
using Habit.Domain.ValueObjects;
using SharedKernel.ResultPattern;
using StrictId;

namespace Habit.Domain.Aggregates;

public sealed class HabitAggregate : Aggregate
{
    private Id<HabitAggregate> Id { get; set; }

    private Guid UserId { get; set; }

    private string Name { get; set; } = string.Empty;

    private string? Description { get; set; }

    private HabitType Type { get; set; }

    private Frequency Frequency { get; set; } = null!;

    private Target Target { get; set; } = null!;

    private HabitStatus Status { get; set; }

    private bool IsArchived { get; set; }

    private DateOnly? EndDate { get; set; }

    private Milestone? Milestone { get; set; }

    private DateTime? LastCompletedAtUtc { get; set; }

    private HabitAggregate() { }

    public static Result<HabitAggregate> Create(
        Guid userId,
        string name,
        string? description,
        HabitType type,
        FrequencyType frequencyType,
        int timesPerPeriod,
        int targetValue,
        string targetUnit,
        DateOnly? endDate,
        int? milestoneTarget,
        int? milestoneCurrent
    )
    {
        var frequencyResult = Frequency.Create(frequencyType, timesPerPeriod);
        if (frequencyResult.IsFailure)
        {
            return Result<HabitAggregate>.BadRequest(frequencyResult.Error!);
        }

        var targetResult = Target.Create(targetValue, targetUnit);
        if (targetResult.IsFailure)
        {
            return Result<HabitAggregate>.BadRequest(targetResult.Error!);
        }

        Milestone? milestone = null;
        if (milestoneTarget is not null && milestoneCurrent is not null)
        {
            var milestoneResult = Milestone.Create(milestoneTarget.Value, milestoneCurrent.Value);
            if (milestoneResult.IsFailure)
            {
                return Result<HabitAggregate>.BadRequest(milestoneResult.Error!);
            }

            milestone = milestoneResult.Value;
        }

        return Result<HabitAggregate>.Success(
            new HabitAggregate
            {
                Id = Id<HabitAggregate>.NewId(),
                UserId = userId,
                Name = name,
                Description = description,
                Type = type,
                Frequency = frequencyResult.Value!,
                Target = targetResult.Value!,
                Status = HabitStatus.Ongoing,
                IsArchived = false,
                EndDate = endDate,
                Milestone = milestone,
            }
        );
    }

    internal static HabitAggregate Restore(HabitEntity entity) =>
        new()
        {
            Id = entity.Id.ToId(),
            UserId = entity.UserId,
            Name = entity.Name,
            Description = entity.Description,
            Type = entity.Type,
            Frequency = entity.Frequency,
            Target = entity.Target,
            Status = entity.Status,
            IsArchived = entity.IsArchived,
            EndDate = entity.EndDate,
            Milestone = entity.Milestone,
            LastCompletedAtUtc = entity.LastCompletedAtUtc,
        };

    public HabitEntity ToEntity() =>
        new()
        {
            Id = Id.ToId(),
            UserId = UserId,
            Name = Name,
            Description = Description,
            Type = Type,
            Frequency = Frequency,
            Target = Target,
            Status = Status,
            IsArchived = IsArchived,
            EndDate = EndDate,
            Milestone = Milestone,
            LastCompletedAtUtc = LastCompletedAtUtc,
        };
}
