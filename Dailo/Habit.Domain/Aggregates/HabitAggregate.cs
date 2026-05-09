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

    public DateTime? LastCompletedAtUtc { get; private set; }

    public IReadOnlyList<HabitTagEntity> Tags { get; private set; } = [];

    private HabitAggregate() { }

    public static Result<HabitAggregate> Create(
        Id<HabitAggregate> id,
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
        int? milestoneCurrent,
        IReadOnlySet<Id> tagIds,
        IReadOnlySet<Id> existingTagIds,
        DateTime? lastCompletedAtUtc
    )
    {
        var tagIdList = tagIds.ToList();

        if (tagIdList.Count > 20)
        {
            return Result<HabitAggregate>.BadRequest("A habit cannot have more than 20 tags.");
        }

        var missingTagIds = tagIdList.Where(tagId => !existingTagIds.Contains(tagId)).ToList();
        if (missingTagIds.Count > 0)
        {
            return Result<HabitAggregate>.NotFound(
                $"Tags not found: {string.Join(", ", missingTagIds)}"
            );
        }

        var frequencyResult = Frequency.Create(frequencyType, timesPerPeriod);
        if (frequencyResult.IsFailure)
        {
            return Result<HabitAggregate>.BadRequest(frequencyResult.Error);
        }

        var targetResult = Target.Create(targetValue, targetUnit);
        if (targetResult.IsFailure)
        {
            return Result<HabitAggregate>.BadRequest(targetResult.Error);
        }

        Milestone? milestone = null;
        if (milestoneTarget is not null && milestoneCurrent is not null)
        {
            var milestoneResult = Milestone.Create(milestoneTarget.Value, milestoneCurrent.Value);
            if (milestoneResult.IsFailure)
            {
                return Result<HabitAggregate>.BadRequest(milestoneResult.Error);
            }

            milestone = milestoneResult.Value;
        }

        var habitId = id;

        return Result<HabitAggregate>.Success(
            new HabitAggregate
            {
                Id = habitId,
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
                LastCompletedAtUtc = lastCompletedAtUtc,
                Tags = tagIdList
                    .Select(tagId => new HabitTagEntity
                    {
                        Id = Id<HabitTagEntity>.NewId(),
                        HabitId = habitId.ToGuid(),
                        TagId = tagId,
                        UserId = userId,
                    })
                    .ToList(),
            }
        );
    }

    public static HabitAggregate Restore(
        Id<HabitAggregate> id,
        Guid userId,
        string name,
        string? description,
        HabitType type,
        Frequency frequency,
        Target target,
        HabitStatus status,
        bool isArchived,
        DateOnly? endDate,
        Milestone? milestone,
        DateTime? lastCompletedAtUtc,
        IReadOnlyList<HabitTagEntity> tags,
        Guid version
    ) =>
        new()
        {
            Id = id,
            UserId = userId,
            Name = name,
            Description = description,
            Type = type,
            Frequency = frequency,
            Target = target,
            Status = status,
            IsArchived = isArchived,
            EndDate = endDate,
            Milestone = milestone,
            LastCompletedAtUtc = lastCompletedAtUtc,
            Tags = tags,
            Version = version,
        };

    public Result Complete(DateTime completedAtUtc)
    {
        if (completedAtUtc > DateTime.UtcNow)
        {
            return Result.BadRequest("Completion date cannot be in the future.");
        }

        if (completedAtUtc <= LastCompletedAtUtc)
        {
            return Result.Success();
        }

        LastCompletedAtUtc = completedAtUtc;
        return Result.Success();
    }

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
            Tags = Tags.ToList(),
            Version = Version,
        };
}
