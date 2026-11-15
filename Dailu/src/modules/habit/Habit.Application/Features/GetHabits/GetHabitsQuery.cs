using Habit.Application.Features.GetHabits.QueryModels;
using Habit.Application.IntegratedServices;
using Habit.Application.Models;
using Habit.Application.Models.Response;
using Habit.Application.Persistence;
using Microsoft.EntityFrameworkCore;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;
using StrictId;

namespace Habit.Application.Features.GetHabits;

public sealed class GetHabitsQuery : IQuery<Result<GetHabitsQueryResponse>> { }

public sealed record GetHabitsQueryResponse(IEnumerable<HabitResponseModel> Habits);

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
                Timing = h.Timing,
                Target = h.Target,
                Status = h.Status,
                Type = h.Type,
                IsArchived = h.IsArchived,
                EndDate = h.EndDate,
                Milestone = h.Milestone,
                CreatedAtUtc = h.CreatedAtUtc,
                AutomationSource = h.AutomationSource,
                AutomationFilter = h.AutomationFilter,
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
            .Select(h => new HabitResponseModel()
            {
                Id = new Id<HabitResponseModel>(h.Id.Value),
                Name = h.Name,
                Description = h.Description,
                Type = h.Type,
                Frequency = FrequencyResponseModel.FromDomain(h.Frequency),
                Timing = TimingResponseModel.FromDomain(h.Timing),
                Target = TargetResponseModel.FromDomain(h.Target),
                Status = h.Status,
                IsArchived = h.IsArchived,
                EndDate = h.EndDate,
                Milestone = h.Milestone is not null
                    ? MilestoneResponseModel.FromDomain(h.Milestone)
                    : null,
                AutomationSource = h.AutomationSource,
                AutomationFilter = h.AutomationFilter,
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
