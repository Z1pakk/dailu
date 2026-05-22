using Habit.Application.IntegratedServices;
using Habit.Application.Models;
using Habit.Application.Persistence;
using Habit.Domain.Aggregates;
using Habit.Domain.Entities;
using Habit.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;
using StrictId;

namespace Habit.Application.Features.UpdateHabit;

public sealed record UpdateHabitCommand(
    Id<HabitModel> HabitId,
    string Name,
    string? Description,
    HabitType Type,
    FrequencyModel Frequency,
    TargetModel Target,
    DateOnly? EndDate,
    MilestoneModel? Milestone,
    IEnumerable<Id<TagModel>> TagIds,
    AutomationSource? AutomationSource
) : ICommand<Result>;

public sealed class UpdateHabitCommandHandler(
    IHabitDbContext dbContext,
    ICurrentUserService currentUserService,
    ITagService tagService
) : ICommandHandler<UpdateHabitCommand, Result>
{
    public async ValueTask<Result> Handle(
        UpdateHabitCommand request,
        CancellationToken cancellationToken
    )
    {
        var habitId = new Id<HabitEntity>(request.HabitId.Value);

        var entity = await dbContext
            .Habits.Include(h => h.Tags)
            .AsNoTracking()
            .FirstOrDefaultAsync(
                h => h.Id == habitId && h.UserId == currentUserService.UserId,
                cancellationToken
            );

        if (entity is null)
        {
            return Result.NotFound("Habit not found.");
        }

        var requestedTagIds = request.TagIds.Select(id => id.ToId()).ToHashSet();
        var tags = await tagService.GetByIdsAsync(request.TagIds.ToHashSet(), cancellationToken);
        var existingTagIds = tags.Keys.Select(k => k.ToId()).ToHashSet();

        var aggregate = HabitAggregate.Restore(
            new Id<HabitAggregate>(entity.Id.Value),
            entity.UserId,
            entity.Name,
            entity.Description,
            entity.Type,
            entity.Frequency,
            entity.Target,
            entity.Status,
            entity.IsArchived,
            entity.EndDate,
            entity.Milestone,
            entity.LastCompletedAtUtc,
            entity.Tags.ToList(),
            entity.Version,
            entity.AutomationSource
        );

        var updateResult = aggregate.Update(
            request.Name,
            request.Description,
            request.Type,
            request.Frequency.Type,
            request.Frequency.TimesPerPeriod,
            request.Target.Value,
            request.Target.Unit,
            request.EndDate,
            request.Milestone?.Target,
            request.Milestone?.Current,
            requestedTagIds,
            existingTagIds,
            request.AutomationSource
        );

        if (updateResult.IsFailure)
        {
            return updateResult;
        }

        var updatedEntity = aggregate.ToEntity();
        var newTags = updatedEntity.Tags.ToList();
        updatedEntity.Tags = [];

        var oldTags = await dbContext
            .HabitTags.Where(t => t.HabitId == habitId)
            .ToListAsync(cancellationToken);

        dbContext.HabitTags.RemoveRange(oldTags);
        dbContext.HabitTags.AddRange(newTags);
        dbContext.Habits.Update(updatedEntity);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}
