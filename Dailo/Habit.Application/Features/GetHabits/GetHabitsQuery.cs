using Habit.Application.Features.GetHabits.QueryModels;
using Habit.Application.IntegratedServices;
using Habit.Application.Models;
using Habit.Application.Persistence;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;
using StrictId;

namespace Habit.Application.Features.GetHabits;

public sealed class GetHabitsQuery : IQuery<Result<GetHabitsQueryResponse>> { }

public sealed record GetHabitsQueryResponse(IEnumerable<HabitModel> Habits);

public sealed class GetHabitsQueryHandler(
    IHabitDbContext habitDbContext,
    ICurrentUserService currentUserService,
    ITagService tagService
) : IQueryHandler<GetHabitsQuery, Result<GetHabitsQueryResponse>>
{
    public async ValueTask<Result<GetHabitsQueryResponse>> Handle(
        GetHabitsQuery request,
        CancellationToken cancellationToken
    )
    {
        var habits = await habitDbContext
            .Habits.AsNoTracking()
            .Where(h => h.UserId == currentUserService.UserId)
            .OrderByDescending(h => h.CreatedAtUtc)
            .Select(h => new GetHabitQueryModel()
            {
                Id = h.Id,
                Name = h.Name,
                Description = h.Description,
                Frequency = h.Frequency,
                Target = h.Target,
                Status = h.Status,
                Type = h.Type,
                IsArchived = h.IsArchived,
                EndDate = h.EndDate,
                Milestone = h.Milestone,
                CreatedAtUtc = h.CreatedAtUtc,
                AutomationSource = h.AutomationSource,
                LastCompletedAtUtc = h.LastCompletedAtUtc,
                TagIds = h.Tags.Select(t => t.TagId).ToList(),
            })
            .ToListAsync(cancellationToken);

        var tagIds = habits
            .SelectMany(h => h.TagIds)
            .Select(id => new Id<TagModel>(id.Value))
            .ToHashSet();

        var tags = await tagService.GetByIdsAsync(tagIds, cancellationToken);

        var habitModels = habits
            .Select(h => new HabitModel
            {
                Id = new Id<HabitModel>(h.Id.Value),
                Name = h.Name,
                Description = h.Description,
                Type = h.Type,
                Frequency = new FrequencyModel(h.Frequency.Type, h.Frequency.TimesPerPeriod),
                Target = new TargetModel(h.Target.Value, h.Target.Unit),
                Status = h.Status,
                IsArchived = h.IsArchived,
                EndDate = h.EndDate,
                Milestone = h.Milestone is not null
                    ? new MilestoneModel(h.Milestone.Target, h.Milestone.Current)
                    : null,
                AutomationSource = h.AutomationSource,
                CreatedAtUtc = h.CreatedAtUtc,
                LastCompletedAtUtc = h.LastCompletedAtUtc,
                Tags = h
                    .TagIds.Select(id => tags.GetValueOrDefault(new Id<TagModel>(id.Value)))
                    .Where(t => t is not null)
                    .ToList()!,
            })
            .ToList();

        return Result<GetHabitsQueryResponse>.Success(new GetHabitsQueryResponse(habitModels));
    }
}
