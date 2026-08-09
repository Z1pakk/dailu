using Habit.Domain.Entities;
using Habit.Domain.Enums;
using Habit.Domain.ValueObjects;
using Habit.Domain.ValueObjects.AutomationFilters;
using SharedKernel.ResultPattern;
using StrictId;

namespace Habit.Domain.Aggregates;

public sealed record HabitAggregateCreateRequest(
    Id<HabitAggregate> Id,
    Guid UserId,
    string Name,
    string? Description,
    HabitType Type,
    FrequencyType FrequencyType,
    int TimesPerPeriod,
    int TargetValue,
    string TargetUnit,
    DateOnly? EndDate,
    int? MilestoneTarget,
    int? MilestoneCurrent,
    IReadOnlySet<Id> TagIds,
    IReadOnlySet<Id> ExistingTagIds,
    DateTime? LastCompletedAtUtc,
    AutomationSource? AutomationSource = null,
    HabitAutomationFilter? AutomationFilter = null
);

public sealed record HabitAggregateRestoreRequest(
    Id<HabitAggregate> Id,
    Guid UserId,
    string Name,
    string? Description,
    HabitType Type,
    Frequency Frequency,
    Target Target,
    HabitStatus Status,
    bool IsArchived,
    DateOnly? EndDate,
    Milestone? Milestone,
    DateTime? LastCompletedAtUtc,
    IReadOnlyList<HabitTagEntity> Tags,
    Guid Version,
    AutomationSource? AutomationSource,
    HabitAutomationFilter? AutomationFilter
);

public sealed record HabitAggregateUpdateRequest(
    string Name,
    string? Description,
    HabitType Type,
    FrequencyType FrequencyType,
    int TimesPerPeriod,
    int TargetValue,
    string TargetUnit,
    DateOnly? EndDate,
    int? MilestoneTarget,
    int? MilestoneCurrent,
    IReadOnlySet<Id> TagIds,
    IReadOnlySet<Id> ExistingTagIds,
    AutomationSource? AutomationSource,
    HabitAutomationFilter? AutomationFilter = null
);

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

    private AutomationSource? AutomationSource { get; set; }

    private DateTime? LastCompletedAtUtc { get; set; }

    private IReadOnlyList<HabitTagEntity> Tags { get; set; } = [];

    private HabitAutomationFilter? AutomationFilter { get; set; }

    private HabitAggregate() { }

    public static Result<HabitAggregate> Create(HabitAggregateCreateRequest request)
    {
        var tagIdList = request.TagIds.ToList();

        if (tagIdList.Count > 20)
        {
            return Result<HabitAggregate>.BadRequest("A habit cannot have more than 20 tags.");
        }

        var missingTagIds = tagIdList
            .Where(tagId => !request.ExistingTagIds.Contains(tagId))
            .ToList();
        if (missingTagIds.Count > 0)
        {
            return Result<HabitAggregate>.NotFound(
                $"Tags not found: {string.Join(", ", missingTagIds)}"
            );
        }

        var frequencyResult = Frequency.Create(request.FrequencyType, request.TimesPerPeriod);
        if (frequencyResult.IsFailure)
        {
            return Result<HabitAggregate>.BadRequest(frequencyResult.Error);
        }

        var targetResult = Target.Create(request.TargetValue, request.TargetUnit);
        if (targetResult.IsFailure)
        {
            return Result<HabitAggregate>.BadRequest(targetResult.Error);
        }

        var automationResult = ValidateAutomation(
            request.AutomationSource,
            request.AutomationFilter
        );
        if (automationResult.IsFailure)
        {
            return Result<HabitAggregate>.BadRequest(automationResult.Error);
        }

        Milestone? milestone = null;
        if (request.MilestoneTarget is not null && request.MilestoneCurrent is not null)
        {
            var milestoneResult = Milestone.Create(
                request.MilestoneTarget.Value,
                request.MilestoneCurrent.Value
            );
            if (milestoneResult.IsFailure)
            {
                return Result<HabitAggregate>.BadRequest(milestoneResult.Error);
            }

            milestone = milestoneResult.Value;
        }

        var habitId = request.Id;

        return Result<HabitAggregate>.Success(
            new HabitAggregate
            {
                Id = habitId,
                UserId = request.UserId,
                Name = request.Name,
                Description = request.Description,
                Type = request.Type,
                Frequency = frequencyResult.Value,
                Target = targetResult.Value,
                Status = HabitStatus.Ongoing,
                IsArchived = false,
                EndDate = request.EndDate,
                Milestone = milestone,
                AutomationSource = request.AutomationSource,
                LastCompletedAtUtc = request.LastCompletedAtUtc,
                Tags = tagIdList
                    .Select(tagId => new HabitTagEntity
                    {
                        Id = Id<HabitTagEntity>.NewId(),
                        HabitId = habitId.ToGuid(),
                        TagId = tagId,
                        UserId = request.UserId,
                    })
                    .ToList(),
                AutomationFilter = request.AutomationFilter,
            }
        );
    }

    public static HabitAggregate Restore(HabitAggregateRestoreRequest request) =>
        new()
        {
            Id = request.Id,
            UserId = request.UserId,
            Name = request.Name,
            Description = request.Description,
            Type = request.Type,
            Frequency = request.Frequency,
            Target = request.Target,
            Status = request.Status,
            IsArchived = request.IsArchived,
            EndDate = request.EndDate,
            Milestone = request.Milestone,
            LastCompletedAtUtc = request.LastCompletedAtUtc,
            Tags = request.Tags,
            Version = request.Version,
            AutomationSource = request.AutomationSource,
            AutomationFilter = request.AutomationFilter,
        };

    public Result Update(HabitAggregateUpdateRequest request)
    {
        var tagIdList = request.TagIds.ToList();

        if (tagIdList.Count > 20)
        {
            return Result.BadRequest("A habit cannot have more than 20 tags.");
        }

        var missingTagIds = tagIdList
            .Where(tagId => !request.ExistingTagIds.Contains(tagId))
            .ToList();
        if (missingTagIds.Count > 0)
        {
            return Result.NotFound($"Tags not found: {string.Join(", ", missingTagIds)}");
        }

        var frequencyResult = Frequency.Create(request.FrequencyType, request.TimesPerPeriod);
        if (frequencyResult.IsFailure)
        {
            return Result.BadRequest(frequencyResult.Error);
        }

        var targetResult = Target.Create(request.TargetValue, request.TargetUnit);
        if (targetResult.IsFailure)
        {
            return Result.BadRequest(targetResult.Error);
        }

        var automationResult = ValidateAutomation(
            request.AutomationSource,
            request.AutomationFilter
        );
        if (automationResult.IsFailure)
        {
            return Result.BadRequest(automationResult.Error);
        }

        Milestone? milestone = null;
        if (request.MilestoneTarget is not null && request.MilestoneCurrent is not null)
        {
            var milestoneResult = Milestone.Create(
                request.MilestoneTarget.Value,
                request.MilestoneCurrent.Value
            );
            if (milestoneResult.IsFailure)
            {
                return Result.BadRequest(milestoneResult.Error);
            }

            milestone = milestoneResult.Value;
        }

        Name = request.Name;
        Description = request.Description;
        Type = request.Type;
        Frequency = frequencyResult.Value;
        Target = targetResult.Value;
        EndDate = request.EndDate;
        Milestone = milestone;
        AutomationSource = request.AutomationSource;
        Tags = tagIdList
            .Select(tagId => new HabitTagEntity
            {
                Id = Id<HabitTagEntity>.NewId(),
                HabitId = Id.ToGuid(),
                TagId = tagId,
                UserId = UserId,
            })
            .ToList();
        AutomationFilter = request.AutomationFilter;

        return Result.Success();
    }

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

    private static Result ValidateAutomation(
        AutomationSource? automationSource,
        HabitAutomationFilter? automationFilter
    )
    {
        if (automationFilter is not null && automationSource is null or Enums.AutomationSource.None)
        {
            return Result.BadRequest("Automation filter requires an automation source to be set.");
        }

        var isValidFilterType = (automationSource, automationFilter) switch
        {
            (_, null) => true,
            (Enums.AutomationSource.Github, GithubAutomationFilter) => true,
            (Enums.AutomationSource.Strava, StravaAutomationFilter) => true,
            (Enums.AutomationSource.GoogleHealth, GoogleHealthAutomationFilter) => true,
            _ => false,
        };

        if (!isValidFilterType)
        {
            return Result.BadRequest(
                "Automation filter type does not match the automation source."
            );
        }

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
            AutomationSource = AutomationSource,
            LastCompletedAtUtc = LastCompletedAtUtc,
            Tags = Tags.ToList(),
            Version = Version,
            AutomationFilter = AutomationFilter,
        };
}
